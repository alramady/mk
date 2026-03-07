import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { seedAdminUser } from "../seed-admin";
import { seedCitiesAndDistricts } from "../seed-cities";
import { seedDefaultSettings } from "../seed-settings";
import { securityHeaders } from "../middleware/security-headers";
import { compressionMiddleware } from "../middleware/compression";
import { sitemapHandler } from "../middleware/sitemap";
import { generateHomepageOG, generatePropertyOG, invalidateCache as invalidateOGCache } from "../og-image";
import { getDb } from "../db";
import { properties, integrationConfigs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { reloadS3Client, getStorageMode } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Load storage (S3/R2) config from the integration_configs DB table
 * and inject into process.env so storage.ts picks it up.
 * This ensures config survives Railway redeployments.
 */
async function loadStorageConfigFromDb(): Promise<void> {
  // Log env vars BEFORE DB load to see if Railway set them directly
  console.log(`[Storage] Pre-DB env check: S3_BUCKET=${process.env.S3_BUCKET ? 'SET' : 'EMPTY'}, S3_ACCESS_KEY_ID=${process.env.S3_ACCESS_KEY_ID ? 'SET' : 'EMPTY'}`);
  try {
    const db = await getDb();
    if (!db) {
      console.log("[Storage] DB not available, skipping config load");
      return;
    }

    const [storageRow] = await db
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, 'storage'))
      .limit(1);

    if (!storageRow || !storageRow.configJson) {
      console.log("[Storage] No storage config found in DB");
      return;
    }

    let config: Record<string, string>;
    try {
      config = JSON.parse(storageRow.configJson as string);
    } catch {
      console.error("[Storage] Failed to parse configJson from DB");
      return;
    }

    // Only apply if we have the minimum required fields
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      console.log("[Storage] DB config incomplete (missing bucket/keys), skipping");
      return;
    }

    // Inject into process.env (same as integration-routers.ts does on save/test)
    process.env.S3_ENDPOINT = config.endpoint || '';
    process.env.S3_BUCKET = config.bucket;
    process.env.S3_ACCESS_KEY_ID = config.accessKeyId;
    process.env.S3_SECRET_ACCESS_KEY = config.secretAccessKey;
    process.env.S3_REGION = config.region || 'auto';
     if (config.publicBaseUrl) process.env.S3_PUBLIC_BASE_URL = config.publicBaseUrl;

    // Reset the S3 client so it picks up the new env vars
    reloadS3Client();
    console.log(`[Storage] \u2705 Loaded R2/S3 config from DB -> bucket: ${config.bucket}, endpoint: ${config.endpoint || 'default'}`);
    console.log(`[Storage] Env check after DB load: S3_BUCKET=${process.env.S3_BUCKET ? 'SET' : 'EMPTY'}, S3_ACCESS_KEY_ID=${process.env.S3_ACCESS_KEY_ID ? 'SET' : 'EMPTY'}, S3_SECRET_ACCESS_KEY=${process.env.S3_SECRET_ACCESS_KEY ? 'SET' : 'EMPTY'}, S3_PUBLIC_BASE_URL=${process.env.S3_PUBLIC_BASE_URL ? 'SET' : 'EMPTY'}`);
  } catch (err) {
    console.error("[Storage] Error loading config from DB:", err);
  }
}

async function startServer() {
  // ─── Production Startup Guards ──────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.MOYASAR_WEBHOOK_SECRET) {
      throw new Error('[FATAL] MOYASAR_WEBHOOK_SECRET is required in production. Server will not start.');
    }
    if (!process.env.TABBY_WEBHOOK_SECRET) {
      throw new Error('[FATAL] TABBY_WEBHOOK_SECRET is required in production. Server will not start.');
    }
    if (!process.env.TAMARA_WEBHOOK_SECRET) {
      throw new Error('[FATAL] TAMARA_WEBHOOK_SECRET is required in production. Server will not start.');
    }
    if (!process.env.REDIS_URL) {
      throw new Error('[FATAL] REDIS_URL is required in production. In-memory fallback is not safe for token blacklisting.');
    }
  }

  const app = express();
  const server = createServer(app);

  // ─── Security Headers (must be first) ──────────────────────────────
  app.use(securityHeaders);

  // ─── Compression (Gzip/Brotli) ────────────────────────────────────
  app.use(compressionMiddleware);

  // ─── Body Parser (route-specific limits) ───────────────────────────
  // Global default: 1MB (prevents large payload DoS)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  // Upload-specific routes: 10MB for base64 image/file uploads
  const uploadJsonParser = express.json({ limit: "10mb" });
  app.use('/trpc/submission.uploadPhoto', uploadJsonParser);
  app.use('/trpc/submission.create', uploadJsonParser);
  app.use('/trpc/property.uploadImages', uploadJsonParser);
  app.use('/trpc/property.update', uploadJsonParser);
  app.use('/trpc/cms.mediaUpload', uploadJsonParser);
  app.use('/trpc/manager.uploadPhoto', uploadJsonParser);
  app.use('/trpc/manager.uploadSelfPhoto', uploadJsonParser);
  app.use('/trpc/auth.updateProfile', uploadJsonParser);
  app.use('/trpc/integration.kyc.submit', uploadJsonParser);

  // Serve uploaded files from local storage
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadDir, {
    maxAge: "7d",
    etag: true,
    lastModified: true,
  }));
  // Fallback: if local file not found and S3 is configured, redirect to R2 public URL
  app.use("/uploads", (req, res, next) => {
    const s3PublicBase = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    if (s3PublicBase) {
      // Strip leading slash from req.path, redirect to R2
      const objectKey = req.path.replace(/^\/+/, "");
      const r2Url = `${s3PublicBase}/${objectKey}`;
      console.log(`[Storage] Local miss → redirecting to R2: ${r2Url}`);
      res.redirect(301, r2Url);
    } else {
      // No S3 configured — return 404
      res.status(404).json({ error: "File not found" });
    }
  });
  console.log(`[Storage] Serving uploads from: ${uploadDir} (with R2 fallback)`);

  // ─── Service Worker (MUST be before static middleware to bypass CDN cache) ──
  app.get("/sw.js", (_req, res) => {
    const swPath = process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../../client/public/sw.js")
      : path.resolve(import.meta.dirname, "public/sw.js");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(swPath);
  });

  // ─── Dynamic Sitemap ──────────────────────────────────────────────
  app.get("/sitemap.xml", sitemapHandler);

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      const { getPool } = await import("../db");
      const pool = getPool();
      let dbStatus = "no pool";
      if (pool) {
        try {
          await pool.execute("SELECT 1");
          dbStatus = "connected";
        } catch (e: any) {
          dbStatus = `error: ${e.message}`;
        }
      }
      // Storage health
      let storageStatus = "unknown";
      try {
        storageStatus = getStorageMode();
      } catch { storageStatus = "error"; }

      res.json({
        status: "ok",
        dbStatus,
        storageMode: storageStatus,
        version: "1.0.0",
        commitSha: process.env.RAILWAY_GIT_COMMIT_SHA || "unknown",
        buildTime: process.env.BUILD_TIME || "unknown",
        envName: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || "unknown",
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      });
    } catch (e: any) {
      res.json({ status: "error", error: e.message });
    }
  });

  // Build version endpoint — used by admin UI to confirm latest deploy
  app.get("/api/build-version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.json({
      buildTime: process.env.BUILD_TIME || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
      serverStarted: new Date().toISOString(),
    });
  });

  // ─── Image Loading Test Page ──────────────────────────────────────
  app.get("/api/test-images", async (_req, res) => {
    const { getPool } = await import("../db");
    const pool = getPool();
    const [rows] = await pool.execute("SELECT id, titleEn, photos FROM properties WHERE photos IS NOT NULL LIMIT 3");
    const props = (rows as any[]).map(r => ({
      id: r.id,
      title: r.titleEn,
      photos: typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos
    }));
    const html = `<!DOCTYPE html><html><head><title>Image Test</title></head><body style="background:#111;color:#fff;font-family:sans-serif;padding:20px">
      <h1>R2 Image Loading Test</h1>
      <p>If images show below, R2 loading works from monthlykey.com context.</p>
      ${props.map(p => `
        <h2>Property ${p.id}: ${p.title}</h2>
        ${(p.photos || []).slice(0, 2).map((url: string, i: number) => `
          <div style="margin:10px 0">
            <p>Photo ${i+1}: <code>${url}</code></p>
            <img src="${url}" style="max-width:400px;max-height:300px;border:2px solid #333" 
                 onerror="this.style.border='3px solid red';this.nextElementSibling.textContent='FAILED TO LOAD'" />
            <p style="color:lime">OK</p>
          </div>
        `).join('')}
      `).join('')}
      <h2>Direct Unsplash (via proxy)</h2>
      <img src="/api/img-proxy?url=${encodeURIComponent('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80')}" style="max-width:400px;border:2px solid #333" 
           onerror="this.style.border='3px solid red'" />
    </body></html>`;
    res.type('html').send(html);
  });

  // ─── Debug Proof Endpoint (acceptance testing) ─────────────────────
  app.get("/api/debug-proof", async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    try {
      const { getPool } = await import("../db");
      const pool = getPool();
      if (!pool) return res.json({ error: "no pool" });

      // Property #2 data
      const [props] = await pool.query(
        `SELECT id, titleAr, titleEn, pricingSource, monthlyRent, status FROM properties WHERE id = 2`
      );
      // Linked unit
      const [units] = await pool.query(
        `SELECT id, unitNumber, monthlyBaseRentSAR, propertyId, buildingId FROM units WHERE propertyId = 2 LIMIT 1`
      );
      // All bookings (with rejection reason)
      const [bookings] = await pool.query(
        `SELECT id, propertyId, unitId, tenantId, status, rejectionReason, monthlyRent, totalAmount, durationMonths, createdAt, updatedAt FROM bookings ORDER BY id DESC LIMIT 10`
      );
      // All ledger entries
      const [ledger] = await pool.query(
        `SELECT id, invoiceNumber, bookingId, unitId, unitNumber, propertyDisplayName, type, direction, amount, currency, status, paymentMethod, provider, dueAt, paidAt, notes, notesAr, createdAt FROM payment_ledger ORDER BY id DESC LIMIT 10`
      );

      // Payment config check
      let paymentConfig = { configured: false, provider: null as string | null };
      try {
        const { isPaymentConfigured } = await import("../finance-registry");
        const pc = await isPaymentConfigured();
        paymentConfig = { configured: pc.configured, provider: pc.provider || null };
      } catch { /* ignore */ }

      // Amount matching proof with status transitions
      const amountMatching = (bookings as any[]).map((b: any) => {
        const linkedLedger = (ledger as any[]).filter((l: any) => l.bookingId === b.id);
        return {
          bookingId: b.id,
          bookingStatus: b.status,
          bookingTotalAmount: b.totalAmount,
          rejectionReason: b.rejectionReason || null,
          ledgerEntries: linkedLedger.map((l: any) => ({
            ledgerId: l.id,
            invoiceNumber: l.invoiceNumber,
            ledgerAmount: l.amount,
            ledgerStatus: l.status,
            amountsMatch: String(b.totalAmount) === String(l.amount),
            paymentMethod: l.paymentMethod,
            provider: l.provider,
            paidAt: l.paidAt,
            notes: l.notes,
          })),
          hasLedger: linkedLedger.length > 0,
          statusWorkflow: {
            description: b.status === 'pending' ? 'PENDING_APPROVAL → awaiting admin action'
              : b.status === 'approved' ? 'APPROVED → awaiting payment'
              : b.status === 'rejected' ? 'REJECTED → ledger should be VOID'
              : b.status === 'active' ? 'ACTIVE → payment confirmed, ledger should be PAID'
              : b.status,
            ledgerConsistent: b.status === 'rejected'
              ? linkedLedger.every((l: any) => l.status === 'VOID')
              : b.status === 'active'
              ? linkedLedger.every((l: any) => l.status === 'PAID')
              : b.status === 'pending' || b.status === 'approved'
              ? linkedLedger.every((l: any) => l.status === 'DUE' || l.status === 'PENDING')
              : true,
          },
        };
      });

      res.json({
        _proofTimestamp: new Date().toISOString(),
        paymentConfig,
        property2: (props as any[])[0] || null,
        linkedUnit: (units as any[])[0] || null,
        recentBookings: bookings,
        recentLedger: ledger,
        amountMatching,
        summary: {
          totalBookings: (bookings as any[]).length,
          totalLedgerEntries: (ledger as any[]).length,
          allBookingsHaveLedger: amountMatching.every(m => m.hasLedger),
          allAmountsMatch: amountMatching.every(m => m.ledgerEntries.every((l: any) => l.amountsMatch)),
          allStatusesConsistent: amountMatching.every(m => m.statusWorkflow.ledgerConsistent),
        },
      });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // ─── Backfill coordinates for properties missing lat/lng ──────────
  app.get("/api/backfill-coordinates", async (_req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    try {
      const { getPool } = await import("../db");
      const pool = getPool();
      if (!pool) return res.json({ error: "no pool" });

      // Riyadh district coordinates lookup
      const districtCoords: Record<string, { lat: string; lng: string }> = {
        "olaya": { lat: "24.6900", lng: "46.6850" },
        "العليا": { lat: "24.6900", lng: "46.6850" },
        "al olaya": { lat: "24.6900", lng: "46.6850" },
        "nakheel": { lat: "24.7700", lng: "46.6400" },
        "النخيل": { lat: "24.7700", lng: "46.6400" },
        "al nakheel": { lat: "24.7700", lng: "46.6400" },
        "malqa": { lat: "24.7900", lng: "46.6300" },
        "الملقا": { lat: "24.7900", lng: "46.6300" },
        "hittin": { lat: "24.7600", lng: "46.6200" },
        "حطين": { lat: "24.7600", lng: "46.6200" },
        "sulaimaniyah": { lat: "24.7000", lng: "46.7000" },
        "السليمانية": { lat: "24.7000", lng: "46.7000" },
        "al yasmin": { lat: "24.8200", lng: "46.6400" },
        "الياسمين": { lat: "24.8200", lng: "46.6400" },
      };
      // Default Riyadh center
      const defaultCoords = { lat: "24.7136", lng: "46.6753" };

      const [rows] = await pool.query(
        `SELECT id, district, districtAr FROM properties WHERE (latitude IS NULL OR latitude = '' OR latitude = '0') AND status != 'archived'`
      );

      const updated: any[] = [];
      for (const row of rows as any[]) {
        const d = (row.district || "").toLowerCase().trim();
        const dAr = (row.districtAr || "").trim();
        const coords = districtCoords[d] || districtCoords[dAr] || defaultCoords;
        // Add small random offset to avoid exact same pin
        const latOffset = (Math.random() - 0.5) * 0.01;
        const lngOffset = (Math.random() - 0.5) * 0.01;
        const lat = (parseFloat(coords.lat) + latOffset).toFixed(7);
        const lng = (parseFloat(coords.lng) + lngOffset).toFixed(7);
        await pool.query(
          `UPDATE properties SET latitude = ?, longitude = ? WHERE id = ?`,
          [lat, lng, row.id]
        );
        updated.push({ id: row.id, district: row.district, lat, lng });
      }

      res.json({ backfilled: updated.length, properties: updated });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // ─── Backfill ledger for old bookings ─────────────────────────────
  app.get("/api/backfill-ledger", async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    try {
      const { getPool } = await import("../db");
      const pool = getPool();
      if (!pool) return res.json({ error: "no pool" });

      // Find bookings without ledger entries
      const [orphanBookings] = await pool.query(`
        SELECT b.id, b.propertyId, b.totalAmount, b.monthlyRent, b.unitId,
               p.titleAr AS propertyName
        FROM bookings b
        LEFT JOIN payment_ledger pl ON pl.bookingId = b.id
        LEFT JOIN properties p ON p.id = b.propertyId
        WHERE pl.id IS NULL
      `);

      const created: any[] = [];
      for (const b of orphanBookings as any[]) {
        const invoiceNumber = `INV-BF-${Date.now()}-${b.id}`;
        // Get unit info if available
        let unitNumber = null;
        if (b.unitId) {
          const [uRows] = await pool.query(`SELECT unitNumber FROM units WHERE id = ?`, [b.unitId]);
          unitNumber = (uRows as any[])[0]?.unitNumber || null;
        }
        await pool.query(`
          INSERT INTO payment_ledger
            (invoiceNumber, bookingId, unitId, unitNumber, propertyDisplayName, type, direction, amount, currency, status, dueAt, createdAt)
          VALUES (?, ?, ?, ?, ?, 'RENT', 'IN', ?, 'SAR', 'DUE', NOW(), NOW())
        `, [invoiceNumber, b.id, b.unitId || null, unitNumber, b.propertyName || 'Unknown', b.totalAmount]);
        created.push({ bookingId: b.id, invoiceNumber, amount: b.totalAmount });
      }

      res.json({ backfilled: created.length, entries: created });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // ─── Dynamic OG Image Generation ─────────────────────────────────────────mepage OG image
  app.get("/api/og/homepage.png", async (_req, res) => {
    try {
      const buffer = await generateHomepageOG();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (e: any) {
      console.error("[OG] Homepage image error:", e);
      res.status(500).json({ error: "Failed to generate OG image" });
    }
  });

  // Property OG image
  app.get("/api/og/property/:id.png", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }
      const [prop] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
      if (!prop) { res.status(404).json({ error: "Property not found" }); return; }
      const buffer = await generatePropertyOG(prop as any);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=43200, stale-while-revalidate=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (e: any) {
      console.error("[OG] Property image error:", e);
      res.status(500).json({ error: "Failed to generate OG image" });
    }
  });

  // Admin: invalidate OG cache (requires admin session or OG_INVALIDATE_SECRET header)
  const ogInvalidateRateMap = new Map<string, { count: number; resetAt: number }>();
  app.post("/api/og/invalidate", async (req, res) => {
    // Rate limit: 10 requests per minute per IP
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const now = Date.now();
    const entry = ogInvalidateRateMap.get(clientIp);
    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > 10) return res.status(429).json({ error: "Too many requests" });
    } else {
      ogInvalidateRateMap.set(clientIp, { count: 1, resetAt: now + 60_000 });
    }
    // Auth: require OG_INVALIDATE_SECRET header or admin session
    const secret = req.headers["x-og-secret"] as string;
    const envSecret = process.env.OG_INVALIDATE_SECRET;
    let authorized = false;
    if (envSecret && secret === envSecret) {
      authorized = true;
    } else {
      // Try to authenticate via session cookie
      try {
        const { sdk: sdkAuth } = await import("./sdk");
        const user = await sdkAuth.authenticateRequest(req);
        if (user && user.role === "admin") authorized = true;
      } catch { /* not authenticated */ }
    }
    if (!authorized) return res.status(401).json({ error: "Unauthorized" });
    const key = req.body?.key as string | undefined;
    invalidateOGCache(key);
    res.json({ success: true, message: key ? `Cache invalidated for: ${key}` : "All OG cache cleared" });
  });

  // Image proxy: serve external CDN images through our domain to avoid CORS/CSP issues
  // SSRF protection: strict domain allowlist + private IP blocking
  const IMG_PROXY_ALLOWED_DOMAINS = [
    "images.unsplash.com",
    "plus.unsplash.com",
    "pub-38c4c6d7eb714a07a24cd2d4c7870282.r2.dev",
    "maps.gstatic.com",
    "maps.googleapis.com",
    "lh3.googleusercontent.com",
    "beds24.com",
    "www.beds24.com",
    "api.beds24.com",
  ];
  // Also allow any *.r2.dev subdomain
  function isAllowedProxyDomain(hostname: string): boolean {
    if (IMG_PROXY_ALLOWED_DOMAINS.includes(hostname)) return true;
    if (hostname.endsWith(".r2.dev")) return true;
    // Allow the configured S3 public base URL domain
    const s3Base = process.env.S3_PUBLIC_BASE_URL;
    if (s3Base) {
      try { if (new URL(s3Base).hostname === hostname) return true; } catch {}
    }
    return false;
  }
  app.get("/api/img-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url || !url.startsWith("https://")) {
        res.status(400).json({ error: "Invalid URL" });
        return;
      }
      // Parse and validate domain against allowlist
      let parsedUrl: URL;
      try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: "Malformed URL" }); }
      if (!isAllowedProxyDomain(parsedUrl.hostname)) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      // Block private/internal IP ranges (defense in depth against DNS rebinding)
      const blockedPatterns = [/^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./, /^169\.254\./, /^0\./, /^localhost$/i, /^\[::1\]$/];
      if (blockedPatterns.some(p => p.test(parsedUrl.hostname))) {
        return res.status(403).json({ error: "Blocked address" });
      }
      const response = await fetch(url);
      if (!response.ok) {
        res.status(response.status).json({ error: "Upstream error" });
        return;
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      // Only allow image content types
      if (!contentType.startsWith("image/")) {
        return res.status(403).json({ error: "Non-image content type" });
      }
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Payment Webhook Routes (PSP callbacks) ─────────────────────
  const { handleMoyasarWebhookVerified } = await import("../moyasar");
  const { handleTabbyWebhook, handleTamaraWebhook } = await import("../payment-webhooks");
  app.post("/api/webhooks/moyasar", handleMoyasarWebhookVerified);
  app.post("/api/webhooks/tabby", handleTabbyWebhook);
  app.post("/api/webhooks/tamara", handleTamaraWebhook);

  // ─── WhatsApp Cloud API Webhook ─────────────────────────────────
  const { handleWhatsAppWebhook, handleWhatsAppVerification } = await import("../whatsapp-cloud");
  app.get("/api/webhooks/whatsapp", handleWhatsAppVerification);
  app.post("/api/webhooks/whatsapp", handleWhatsAppWebhook);

  // Local authentication routes (login, register, change-password)
  registerAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error, type }) => {
        // Structured error logging for tRPC — only log server errors (not client errors like BAD_REQUEST)
        const isServerError = !['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'TOO_MANY_REQUESTS'].includes(error.code);
        if (isServerError) {
          const entry = {
            ts: new Date().toISOString(),
            level: 'error',
            component: 'trpc',
            msg: `tRPC ${type} error on ${path}`,
            code: error.code,
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join(' | '),
          };
          process.stderr.write(JSON.stringify(entry) + '\n');
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Seed admin user and default settings on startup
  seedAdminUser().catch(err => console.error("[Seed] Failed:", err));
  seedCitiesAndDistricts().catch(err => console.error("[Seed] Cities failed:", err));
  seedDefaultSettings().catch(err => console.error("[Seed] Settings failed:", err));

  // ─── Load integration configs from DB (survives Railway redeploy) ──
  // MUST await before server.listen so storage mode is resolved before any request
  try {
    await loadStorageConfigFromDb();
  } catch (err) {
    console.error("[Storage] DB config load failed:", err);
  }

  // Log final storage state for debugging
  console.log(`[Storage] Final mode at boot: ${getStorageMode()}`);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
