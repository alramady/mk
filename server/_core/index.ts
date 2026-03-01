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
import { reloadS3Client } from "../storage";

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

    console.log(`[Storage] ✅ Loaded R2/S3 config from DB → bucket: ${config.bucket}, endpoint: ${config.endpoint || 'default'}`);
  } catch (err) {
    console.error("[Storage] Error loading config from DB:", err);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Security Headers (must be first) ──────────────────────────────
  app.use(securityHeaders);

  // ─── Compression (Gzip/Brotli) ────────────────────────────────────
  app.use(compressionMiddleware);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
      res.json({ status: "ok", dbStatus, version: "1.0.0" });
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

  // ─── Debug Proof Endpoint (acceptance testing) ─────────────────────
  app.get("/api/debug-proof", async (req, res) => {
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

  // ─── Backfill ledger for old bookings ─────────────────────────────
  app.get("/api/backfill-ledger", async (req, res) => {
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

  // Admin: invalidate OG cache
  app.post("/api/og/invalidate", (req, res) => {
    const key = req.body?.key as string | undefined;
    invalidateOGCache(key);
    res.json({ success: true, message: key ? `Cache invalidated for: ${key}` : "All OG cache cleared" });
  });

  // Image proxy: serve external CDN images through our domain to avoid CORS/CSP issues
  app.get("/api/img-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url || !url.startsWith("https://")) {
        res.status(400).json({ error: "Invalid URL" });
        return;
      }
      const response = await fetch(url);
      if (!response.ok) {
        res.status(response.status).json({ error: "Upstream error" });
        return;
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
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
  loadStorageConfigFromDb().catch(err => console.error("[Storage] DB config load failed:", err));

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
