/**
 * Server-side proxy for monthlykey.com tRPC API
 * Forwards /api/mk/* → https://monthlykey.com/api/trpc/*
 * This avoids CORS issues in both dev and production
 */

import type { Express, Request, Response } from "express";
import axios from "axios";

const MK_API_BASE = "https://monthlykey.com/api/trpc";

export function registerMkProxy(app: Express) {
  // Proxy GET requests: /api/mk/:procedure
  app.get("/api/mk/:procedure", async (req: Request, res: Response) => {
    try {
      const { procedure } = req.params;
      const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
      const targetUrl = `${MK_API_BASE}/${procedure}${queryString}`;

      const response = await axios.get(targetUrl, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 15000,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error(`[MK Proxy] Error proxying ${req.params.procedure}:`, error?.message);
      const status = error?.response?.status || 502;
      res.status(status).json({
        error: "Proxy error",
        message: error?.message || "Failed to reach monthlykey.com API",
      });
    }
  });

  // Proxy POST requests: /api/mk/:procedure
  app.post("/api/mk/:procedure", async (req: Request, res: Response) => {
    try {
      const { procedure } = req.params;
      const targetUrl = `${MK_API_BASE}/${procedure}`;

      const response = await axios.post(targetUrl, req.body, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 15000,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error(`[MK Proxy] Error proxying POST ${req.params.procedure}:`, error?.message);
      const status = error?.response?.status || 502;
      res.status(status).json({
        error: "Proxy error",
        message: error?.message || "Failed to reach monthlykey.com API",
      });
    }
  });

  console.log("[MK Proxy] Registered /api/mk/* → monthlykey.com/api/trpc/*");
}
