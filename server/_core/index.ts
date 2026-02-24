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
