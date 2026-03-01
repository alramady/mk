/**
 * Dynamic Sitemap Generator
 * Generates a comprehensive sitemap.xml with:
 * - Static pages (home, search, FAQ, legal, contact)
 * - Dynamic property pages with lastmod from DB
 * - City-filtered search pages
 * - hreflang annotations for Arabic/English
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { properties, cities } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const BASE_URL = process.env.PUBLIC_URL || "https://monthlykey.com";

export async function sitemapHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();

    // Static pages
    const staticPages = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/search", changefreq: "daily", priority: "0.9" },
      { loc: "/map", changefreq: "weekly", priority: "0.7" },
      { loc: "/faq", changefreq: "monthly", priority: "0.5" },
      { loc: "/contact", changefreq: "monthly", priority: "0.5" },
      { loc: "/terms", changefreq: "monthly", priority: "0.3" },
      { loc: "/privacy", changefreq: "monthly", priority: "0.3" },
    ];

    // Dynamic pages: published properties
    let propertyPages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [];
    let cityPages: Array<{ loc: string; changefreq: string; priority: string }> = [];

    if (db) {
      try {
        const allProperties = await db
          .select({ 
            id: properties.id, 
            updatedAt: properties.updatedAt,
            photos: properties.photos,
            titleAr: properties.titleAr,
          })
          .from(properties)
          .where(eq(properties.status, "active"))
          .orderBy(desc(properties.updatedAt))
          .limit(5000);

        propertyPages = allProperties.map((p) => ({
          loc: `/property/${p.id}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : undefined,
        }));

        const allCities = await db
          .select({ id: cities.id, slug: cities.nameEn })
          .from(cities)
          .limit(100);

        cityPages = allCities.map((c) => ({
          loc: `/search?city=${c.id}`,
          changefreq: "weekly",
          priority: "0.7",
        }));
      } catch (dbErr) {
        console.warn("[Sitemap] DB query failed, generating static-only sitemap:", dbErr);
      }
    }

    const allPages = [...staticPages, ...propertyPages, ...cityPages];
    const today = new Date().toISOString().split("T")[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allPages
  .map(
    (page) => `  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${page.lastmod || today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${BASE_URL}${page.loc}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${page.loc}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${page.loc}" />
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.status(200).send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
}
