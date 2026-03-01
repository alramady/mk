import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { prerenderMiddleware } from "../middleware/prerender";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Return proper 404 for missing uploaded files in dev mode too
  app.use("/uploads/*", (_req, res) => {
    res.status(404).json({ error: "File not found" });
  });
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Read the HTML template once for prerender middleware
  const indexPath = path.resolve(distPath, "index.html");
  let htmlTemplate = '';
  try {
    htmlTemplate = fs.readFileSync(indexPath, 'utf-8');
    console.log('[Prerender] HTML template loaded for bot serving');
  } catch (err) {
    console.error('[Prerender] Failed to load HTML template:', err);
  }

  // Prerender middleware for bots - MUST be before express.static
  // so bot requests to / /search /property/:id are intercepted first
  if (htmlTemplate) {
    app.use(prerenderMiddleware(htmlTemplate));
  }

  // Serve static assets with long cache headers for immutable files
  app.use(express.static(distPath, {
    maxAge: '1y',           // Long cache for hashed assets
    immutable: true,        // Assets are content-hashed, safe to cache forever
    etag: true,
    lastModified: true,
    index: false,           // Don't serve index.html for / - let SPA fallback handle it
    setHeaders: (res, filePath) => {
      // HTML files should not be cached aggressively
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
      // Service worker MUST NOT be cached — browsers need to check for updates
      else if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // CSS/JS with hash in filename - cache for 1 year
      else if (filePath.match(/\.(js|css)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Images - cache for 30 days
      else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
      }
      // Fonts - cache for 1 year
      else if (filePath.match(/\.(woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // Redirect missing uploads to R2 when S3 is configured, else 404
  app.use("/uploads/*", (req, res) => {
    const s3PublicBase = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    if (s3PublicBase) {
      const objectKey = req.path.replace(/^\/uploads\//, "");
      res.redirect(301, `${s3PublicBase}/${objectKey}`);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // SPA fallback: serve index.html for all non-file requests
  app.use("*", (_req, res) => {
    if (htmlTemplate) {
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(htmlTemplate);
    } else {
      res.sendFile(indexPath);
    }
  });
}
