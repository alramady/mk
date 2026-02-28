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
import { properties } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
  console.log(`[Storage] Serving uploads from: ${uploadDir}`);

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


  // ─── Temporary Debug Endpoint for Acceptance Testing ─────────────
  app.get("/api/debug-proof", async (req, res) => {
    try {
      const { getPool } = await import("../db");
      const pool = getPool();
      if (!pool) return res.json({ error: "no pool" });
      
      // Property #2 data
      const [props] = await pool.query(`SELECT id, titleAr, titleEn, pricingSource, monthlyRent, status FROM properties WHERE id = 2`);
      
      // Linked unit for property #2
      const [units] = await pool.query(`SELECT id, unitNumber, monthlyBaseRentSAR, propertyId, buildingId FROM units WHERE propertyId = 2 LIMIT 1`);
      
      // All bookings
      const [bookings] = await pool.query(`SELECT id, propertyId, tenantId, status, monthlyRent, totalAmount, durationMonths FROM bookings ORDER BY id DESC LIMIT 5`);
      
      // All ledger entries
      const [ledger] = await pool.query(`SELECT id, invoiceNumber, bookingId, unitId, type, amount, status, propertyDisplayName FROM payment_ledger ORDER BY id DESC LIMIT 5`);
      
      // Property #2 photos count from JSON field
      const prop2 = (props as any[])[0];
      const photoCount = prop2?.photos ? (typeof prop2.photos === 'string' ? JSON.parse(prop2.photos) : prop2.photos).length : 0;
      
      res.json({
        property2: prop2 || null,
        linkedUnit: (units as any[])[0] || null,
        recentBookings: bookings,
        recentLedger: ledger,
        property2PhotoCount: photoCount,
      });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // ─── Dynamic OG Image Generation ─────────────────────────────────
  // Homepage OG image
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

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
