/**
 * ═══════════════════════════════════════════════════════════════
 *  Monthly Key Adapter API — Enterprise Dual-Mode Writer Lock
 * ═══════════════════════════════════════════════════════════════
 *
 *  MODE_MONTHLYKEY=standalone  (default, safest)
 *    → Adapter IS the designated booking writer
 *    → Calls Beds24 DIRECTLY via @mk/beds24-sdk
 *    → Hub-API MUST reject MONTHLYKEY booking writes (409)
 *
 *  MODE_MONTHLYKEY=integrated
 *    → Hub-API IS the designated booking writer
 *    → Adapter MUST reject booking writes (409)
 *    → Frontend calls hub-api directly for booking creation
 *
 *  INVARIANT: Exactly ONE writer per brand at any time.
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pino from "pino";
import { createBeds24SDK } from "@mk/beds24-sdk";
import {
  BRAND_RULES,
  HTTP_STATUS,
  ERROR_CODES,
  IDEMPOTENCY_TTL_MS,
  isWriterAllowed,
  getDesignatedWriter,
} from "@mk/shared";
import type { Brand, OperationMode, WriterLockError } from "@mk/shared";

// ─── Configuration ─────────────────────────────────────────
const BRAND: Brand = "MONTHLYKEY";
const MODE = (process.env.MODE_MONTHLYKEY ?? "standalone") as OperationMode;
const PORT = parseInt(process.env.PORT_MK_ADAPTER ?? "4002", 10);
const HUB_API_URL = process.env.HUB_API_URL ?? "http://localhost:4000";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// ─── Writer lock resolved at startup ───────────────────────
const DESIGNATED_WRITER = getDesignatedWriter(MODE);
const ADAPTER_IS_WRITER = isWriterAllowed(MODE, "adapter");

logger.info({
  brand: BRAND, mode: MODE,
  designatedWriter: DESIGNATED_WRITER,
  adapterIsWriter: ADAPTER_IS_WRITER,
}, "Writer lock configuration resolved");

// ─── Beds24 SDK (ONLY in standalone mode) ──────────────────
let beds24: ReturnType<typeof createBeds24SDK> | null = null;

if (MODE === "standalone") {
  const apiUrl = process.env.BEDS24_API_URL ?? "https://api.beds24.com";
  const refreshToken = process.env.BEDS24_REFRESH_TOKEN ?? "";
  if (!refreshToken) {
    logger.error("FATAL: MODE_MONTHLYKEY=standalone requires BEDS24_REFRESH_TOKEN");
  } else {
    beds24 = createBeds24SDK({ apiUrl, refreshToken });
    logger.info("Beds24 SDK initialized for standalone mode");
  }
} else {
  logger.info("Integrated mode — Beds24 SDK NOT initialized, proxying reads to hub-api");
}

// ─── Idempotency Store (in-memory, standalone only) ────────
interface IdempotencyEntry {
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: number;
}
const idempotencyCache = new Map<string, IdempotencyEntry>();

function computeHash(body: unknown): string {
  const str = JSON.stringify(body, Object.keys(body as object).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Express App ───────────────────────────────────────────
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("short"));

// ─── Hub-API Proxy ─────────────────────────────────────────
async function proxyToHub(path: string, options: RequestInit) {
  const url = `${HUB_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─── Writer Lock Rejection ─────────────────────────────────
function writerLockReject(res: express.Response) {
  const body: WriterLockError = {
    code: ERROR_CODES.WRITER_LOCK_VIOLATION,
    message:
      `Booking writes for ${BRAND} are locked to ${DESIGNATED_WRITER}. ` +
      (MODE === "integrated"
        ? `In integrated mode, call POST ${HUB_API_URL}/api/v1/bookings directly.`
        : `In standalone mode, the adapter handles writes — hub-api must not.`),
    brand: BRAND,
    mode: MODE,
    designatedWriter: DESIGNATED_WRITER,
    rejectedBy: "adapter",
  };
  return res.status(HTTP_STATUS.CONFLICT).json(body);
}

// ═══════════════════════════════════════════════════════════
//  UNITS — Read-only, both modes
// ═══════════════════════════════════════════════════════════

app.get("/api/v1/units", async (req, res) => {
  try {
    if (MODE === "standalone" && beds24) {
      const properties = await beds24.properties.getProperties();
      const mapped = properties.map((p) => ({
        id: String(p.id),
        beds24PropertyId: String(p.id),
        title: p.name,
        titleAr: "", // To be enriched from local mapping
        city: p.city ?? "",
        address: p.address ?? "",
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        currency: p.currency ?? "SAR",
        status: "ACTIVE",
        brand: BRAND,
      }));
      return res.json({ data: mapped, total: mapped.length, page: 1, limit: 100, totalPages: 1 });
    }
    const params = new URLSearchParams({ ...(req.query as Record<string, string>), brand: BRAND });
    const { status, data } = await proxyToHub(`/api/v1/units?${params}`, { method: "GET" });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Failed to fetch units");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل في جلب الوحدات" });
  }
});

app.get("/api/v1/units/:id", async (req, res) => {
  try {
    if (MODE === "standalone" && beds24) {
      const p = await beds24.properties.getProperty(Number(req.params.id));
      return res.json({
        id: String(p.id), beds24PropertyId: String(p.id), title: p.name, titleAr: "",
        city: p.city ?? "", address: p.address ?? "",
        latitude: p.latitude ?? null, longitude: p.longitude ?? null,
        currency: p.currency ?? "SAR", status: "ACTIVE", brand: BRAND,
      });
    }
    const { status, data } = await proxyToHub(`/api/v1/units/${req.params.id}`, { method: "GET" });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Failed to fetch unit");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل في جلب الوحدة" });
  }
});

// ═══════════════════════════════════════════════════════════
//  AVAILABILITY
// ═══════════════════════════════════════════════════════════

app.get("/api/v1/availability/:roomId", async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query as { checkIn?: string; checkOut?: string };
    if (!checkIn || !checkOut) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION, message: "checkIn and checkOut query params required",
      });
    }
    if (MODE === "standalone" && beds24) {
      const available = await beds24.inventory.checkAvailability(Number(req.params.roomId), checkIn, checkOut);
      return res.json({ roomId: req.params.roomId, checkIn, checkOut, available });
    }
    const qs = new URLSearchParams({ checkIn, checkOut });
    const { status, data } = await proxyToHub(`/api/v1/availability/${req.params.roomId}?${qs}`, { method: "GET" });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Availability check failed");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل فحص التوفر" });
  }
});

// ═══════════════════════════════════════════════════════════
//  QUOTES — Read-only, both modes
// ═══════════════════════════════════════════════════════════

app.post("/api/v1/bookings/quote", async (req, res) => {
  try {
    const body = { ...req.body, brand: BRAND };
    if (MODE === "standalone" && beds24) {
      const { unitId, checkIn, checkOut } = body;
      if (!unitId || !checkIn || !checkOut) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.VALIDATION, message: "unitId, checkIn, checkOut required",
        });
      }
      const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
      if (nights < BRAND_RULES.MONTHLYKEY.minNights || nights > BRAND_RULES.MONTHLYKEY.maxNights) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: ERROR_CODES.BRAND_RULE_VIOLATION,
          message: `المفتاح الشهري يتطلب ${BRAND_RULES.MONTHLYKEY.minNights}-${BRAND_RULES.MONTHLYKEY.maxNights} ليلة، تم إدخال ${nights}`,
        });
      }
      const calendar = await beds24.inventory.getCalendar(Number(unitId), checkIn, checkOut);
      const available = calendar.every((d) => d.available > 0);
      const avgPrice = calendar.length > 0
        ? calendar.reduce((s, d) => s + (d.price ?? 0), 0) / calendar.length
        : 0;
      // Monthly Key uses monthly pricing
      const monthlyTotal = Math.round(avgPrice * nights);
      return res.json({
        unitId, checkIn, checkOut, nights,
        pricePerNight: Math.round(avgPrice),
        pricePerMonth: Math.round(avgPrice * 30),
        total: monthlyTotal,
        currency: "SAR", available,
      });
    }
    const { status, data } = await proxyToHub("/api/v1/bookings/quote", {
      method: "POST", body: JSON.stringify(body),
    });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Quote failed");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل في حساب السعر" });
  }
});

// ═══════════════════════════════════════════════════════════
//  BOOKING CREATE — Writer Lock Enforced
//
//  standalone  → adapter writes to Beds24 directly
//  integrated  → adapter returns 409
// ═══════════════════════════════════════════════════════════

app.post("/api/v1/bookings", async (req, res) => {
  // ── INTEGRATED MODE: reject with 409 ─────────────────────
  if (!ADAPTER_IS_WRITER) {
    return writerLockReject(res);
  }

  // ── STANDALONE MODE: adapter is the writer ───────────────
  if (!beds24) {
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      code: ERROR_CODES.SDK_NOT_INITIALIZED,
      message: "Beds24 SDK not available — check BEDS24_REFRESH_TOKEN",
    });
  }

  try {
    // 1. Require Idempotency-Key header
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey || idempotencyKey.length < 8) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        message: "Idempotency-Key header is required (min 8 chars) for booking creation",
      });
    }

    // 2. Idempotency dedup
    const reqHash = computeHash(req.body);
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached) {
      if (cached.requestHash !== reqHash) {
        return res.status(HTTP_STATUS.UNPROCESSABLE).json({
          code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
          message: "This Idempotency-Key was already used with different request parameters",
        });
      }
      logger.info({ idempotencyKey }, "Returning cached booking response (idempotent replay)");
      return res.status(cached.responseStatus).json(cached.responseBody);
    }

    // 3. Validate request
    const { checkIn, checkOut, roomId, propertyId, guestFirstName, guestLastName, guestEmail, guestPhone } = req.body;
    if (!checkIn || !checkOut || !roomId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION, message: "checkIn, checkOut, and roomId are required",
      });
    }

    // 4. Validate brand rules (28-365 nights for Monthly Key)
    const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
    if (nights < BRAND_RULES.MONTHLYKEY.minNights || nights > BRAND_RULES.MONTHLYKEY.maxNights) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.BRAND_RULE_VIOLATION,
        message: `المفتاح الشهري يتطلب ${BRAND_RULES.MONTHLYKEY.minNights}-${BRAND_RULES.MONTHLYKEY.maxNights} ليلة، تم إدخال ${nights}`,
      });
    }

    // 5. Availability re-check IMMEDIATELY before write
    logger.info({ roomId, checkIn, checkOut }, "Re-checking availability before write");
    const available = await beds24.inventory.checkAvailability(Number(roomId), checkIn, checkOut);
    if (!available) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        code: ERROR_CODES.AVAILABILITY_CHANGED,
        message: "الوحدة لم تعد متاحة للتواريخ المحددة (فشل إعادة فحص التوفر)",
      });
    }

    // 6. Write to Beds24
    const booking = await beds24.bookings.createBooking({
      propertyId: Number(propertyId ?? roomId),
      roomId: Number(roomId),
      arrival: checkIn,
      departure: checkOut,
      guestFirstName: guestFirstName ?? "",
      guestLastName: guestLastName ?? "",
      guestEmail: guestEmail ?? "",
      guestPhone: guestPhone ?? "",
      numAdult: req.body.numAdult ?? req.body.guests ?? 1,
      numChild: req.body.numChild ?? 0,
      price: req.body.price,
      currency: req.body.currency ?? "SAR",
      notes: `[MK] idem:${idempotencyKey}`,
    });

    const responseBody = {
      id: String(booking.id),
      beds24BookingId: String(booking.id),
      brand: BRAND,
      roomId: String(roomId),
      checkIn, checkOut, nights,
      guestFirstName: booking.guestFirstName,
      guestLastName: booking.guestLastName,
      guestEmail: booking.guestEmail,
      status: booking.status ?? "CONFIRMED",
      writer: "adapter",
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    // 7. Cache idempotency response
    idempotencyCache.set(idempotencyKey, {
      requestHash: reqHash,
      responseStatus: HTTP_STATUS.CREATED,
      responseBody,
      createdAt: Date.now(),
    });

    logger.info({ bookingId: booking.id, idempotencyKey, brand: BRAND, writer: "adapter" },
      "Booking created in Beds24 (standalone mode)");

    res.status(HTTP_STATUS.CREATED).json(responseBody);
  } catch (err: any) {
    logger.error({ err }, "Booking creation failed in standalone mode");
    res.status(HTTP_STATUS.INTERNAL).json({
      code: ERROR_CODES.INTERNAL, message: err.message ?? "فشل إنشاء الحجز",
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  BOOKING READ — Both modes
// ═══════════════════════════════════════════════════════════

app.get("/api/v1/bookings", async (req, res) => {
  try {
    if (MODE === "standalone" && beds24) {
      const list = await beds24.bookings.getBookings({
        propertyId: req.query.propertyId ? Number(req.query.propertyId) : undefined,
        arrivalFrom: req.query.arrivalFrom as string,
        arrivalTo: req.query.arrivalTo as string,
      });
      return res.json({ data: list, total: list.length });
    }
    const params = new URLSearchParams({ ...(req.query as Record<string, string>), brand: BRAND });
    const { status, data } = await proxyToHub(`/api/v1/bookings?${params}`, {
      method: "GET", headers: { Authorization: req.headers.authorization ?? "" },
    });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Failed to fetch bookings");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل في جلب الحجوزات" });
  }
});

app.get("/api/v1/bookings/:id", async (req, res) => {
  try {
    if (MODE === "standalone" && beds24) {
      const b = await beds24.bookings.getBooking(Number(req.params.id));
      return res.json(b);
    }
    const { status, data } = await proxyToHub(`/api/v1/bookings/${req.params.id}`, {
      method: "GET", headers: { Authorization: req.headers.authorization ?? "" },
    });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Failed to fetch booking");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.UPSTREAM_ERROR, message: "فشل في جلب الحجز" });
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTH — Always proxy to hub-api
// ═══════════════════════════════════════════════════════════

app.post("/api/v1/auth/:action", async (req, res) => {
  try {
    const { status, data } = await proxyToHub(`/api/v1/auth/${req.params.action}`, {
      method: "POST", body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(HTTP_STATUS.BAD_GATEWAY).json({ code: ERROR_CODES.PROXY_ERROR, message: "Failed to reach Hub API" });
  }
});

// ═══════════════════════════════════════════════════════════
//  LOCATION RESOLVE — Always proxied to hub-api
//  (Location is a shared service, not brand-specific)
//  Does NOT touch writer-lock code paths.
// ═══════════════════════════════════════════════════════════

app.post("/api/v1/location/resolve", async (req, res) => {
  try {
    const { status, data } = await proxyToHub("/api/v1/location/resolve", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    res.status(status).json(data);
  } catch (err) {
    logger.error({ err }, "Location resolve proxy failed");
    res.status(HTTP_STATUS.BAD_GATEWAY).json({
      code: ERROR_CODES.PROXY_ERROR,
      message: "Failed to reach Hub API for location resolve",
    });
  }
});

app.get("/api/v1/location/status", async (_req, res) => {
  try {
    const { status, data } = await proxyToHub("/api/v1/location/status", { method: "GET" });
    res.status(status).json(data);
  } catch (err) {
    res.status(HTTP_STATUS.BAD_GATEWAY).json({
      code: ERROR_CODES.PROXY_ERROR,
      message: "Failed to reach Hub API for location status",
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  HEALTH (liveness) — Always 200 if process is alive
// ═══════════════════════════════════════════════════════════

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "monthlykey-adapter-api",
    brand: BRAND,
    mode: MODE,
    designatedWriter: DESIGNATED_WRITER,
    adapterIsWriter: ADAPTER_IS_WRITER,
    beds24SdkConnected: beds24 !== null,
    hubApiUrl: MODE === "integrated" ? HUB_API_URL : undefined,
    idempotencyCacheSize: idempotencyCache.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════
//  READY (readiness) — 200 if dependencies are reachable
// ═══════════════════════════════════════════════════════════

app.get("/ready", async (_req, res) => {
  const checks: Record<string, boolean> = {};
  let allReady = true;

  if (MODE === "standalone") {
    // Beds24 SDK must be initialized
    checks.beds24Sdk = beds24 !== null;
    if (!checks.beds24Sdk) allReady = false;
  } else {
    // Hub-API must be reachable
    try {
      const hubRes = await fetch(`${HUB_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
      checks.hubApi = hubRes.ok;
    } catch {
      checks.hubApi = false;
      allReady = false;
    }
  }

  res.status(allReady ? 200 : 503).json({
    ready: allReady,
    service: "monthlykey-adapter-api",
    mode: MODE,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════
//  METRICS — Basic operational counters
// ═══════════════════════════════════════════════════════════

app.get("/metrics", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    service: "monthlykey-adapter-api",
    brand: BRAND,
    mode: MODE,
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    idempotency_cache_size: idempotencyCache.size,
    writer: DESIGNATED_WRITER,
    node_version: process.version,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info("═══════════════════════════════════════════════");
  logger.info(`  Monthly Key Adapter API — port ${PORT}`);
  logger.info(`  Mode: ${MODE}`);
  logger.info(`  Designated writer: ${DESIGNATED_WRITER}`);
  logger.info(`  Adapter writes: ${ADAPTER_IS_WRITER ? "YES (Beds24 direct)" : "NO (409 on POST /bookings)"}`);
  if (MODE === "integrated") {
    logger.info(`  Hub API: ${HUB_API_URL}`);
  }
  logger.info("═══════════════════════════════════════════════");
});

export default app;
