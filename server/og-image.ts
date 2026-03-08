/**
 * Dynamic OG Image Generator
 * 
 * Generates premium 1200x630 Open Graph images using Sharp + SVG overlay.
 * Two types:
 *   1. Homepage: branded hero with logo prominently centered, tagline, and property types
 *   2. Property: property photo background with dark overlay + text details
 * 
 * Arabic text is rendered via system Noto Sans Arabic font.
 * Images are cached in-memory with configurable TTL.
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";

const WIDTH = 1200;
const HEIGHT = 630;

// In-memory cache: key → { buffer, timestamp }
const cache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

function setCache(key: string, buffer: Buffer): void {
  // Limit cache size to prevent memory issues
  if (cache.size > 200) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) {
      cache.delete(oldest[i][0]);
    }
  }
  cache.set(key, { buffer, timestamp: Date.now() });
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/** Escape text for safe SVG embedding */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format price with Arabic locale */
function fmtPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("ar-SA").format(num);
}

/** Truncate text to max length */
function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.substring(0, max) + "..." : str;
}

/** Resolve the logo path (works in both dev and production) */
function getLogoPath(): string {
  // Try multiple locations
  const candidates = [
    path.resolve(process.cwd(), "client/public/logo-mark-light.png"),
    path.resolve(import.meta.dirname, "../client/public/logo-mark-light.png"),
    path.resolve(import.meta.dirname, "public/logo-mark-light.png"),
    path.resolve(process.cwd(), "dist/public/logo-mark-light.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // fallback
}

/**
 * Generate the homepage OG image
 * Premium branded design with logo prominently centered, gradient background, and tagline
 */
export async function generateHomepageOG(): Promise<Buffer> {
  const cacheKey = "og:homepage";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Load and resize logo — prominently centered and large
  let logoComposite: sharp.OverlayOptions[] = [];
  try {
    const logoPath = getLogoPath();
    if (fs.existsSync(logoPath)) {
      const logoBuf = await sharp(logoPath)
        .resize(140, 140, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      // Center the logo horizontally, position at top area
      logoComposite = [{ input: logoBuf, top: 50, left: Math.round((WIDTH - 140) / 2) }];
    }
  } catch (e) {
    console.warn("[OG] Logo load failed:", e);
  }

  const svg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    // Premium dark gradient background
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" style="stop-color:#0A1628;stop-opacity:1" />`,
    `<stop offset="40%" style="stop-color:#0f2240;stop-opacity:1" />`,
    `<stop offset="100%" style="stop-color:#132040;stop-opacity:1" />`,
    `</linearGradient>`,
    // Gold accent gradient
    `<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">`,
    `<stop offset="0%" style="stop-color:#C5A55A;stop-opacity:0" />`,
    `<stop offset="30%" style="stop-color:#C5A55A;stop-opacity:0.6" />`,
    `<stop offset="50%" style="stop-color:#D4B96E;stop-opacity:1" />`,
    `<stop offset="70%" style="stop-color:#C5A55A;stop-opacity:0.6" />`,
    `<stop offset="100%" style="stop-color:#C5A55A;stop-opacity:0" />`,
    `</linearGradient>`,
    // Teal accent gradient
    `<linearGradient id="teal" x1="0%" y1="0%" x2="100%" y2="0%">`,
    `<stop offset="0%" style="stop-color:#3ECFC0;stop-opacity:0" />`,
    `<stop offset="50%" style="stop-color:#3ECFC0;stop-opacity:0.5" />`,
    `<stop offset="100%" style="stop-color:#3ECFC0;stop-opacity:0" />`,
    `</linearGradient>`,
    // Glow effect for logo area
    `<radialGradient id="glow" cx="50%" cy="25%" r="30%">`,
    `<stop offset="0%" style="stop-color:#C5A55A;stop-opacity:0.08" />`,
    `<stop offset="100%" style="stop-color:#C5A55A;stop-opacity:0" />`,
    `</radialGradient>`,
    `</defs>`,

    // Background
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`,

    // Subtle glow behind logo
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>`,

    // Top gold accent line
    `<rect x="0" y="0" width="${WIDTH}" height="3" fill="url(#gold)"/>`,

    // Subtle vertical side accents
    `<rect x="60" y="100" width="2" height="430" fill="#C5A55A" opacity="0.08"/>`,
    `<rect x="${WIDTH - 62}" y="100" width="2" height="430" fill="#C5A55A" opacity="0.08"/>`,

    // Corner decorations (subtle L-shapes)
    `<path d="M 80 80 L 80 110 M 80 80 L 110 80" stroke="#C5A55A" stroke-width="1.5" fill="none" opacity="0.15"/>`,
    `<path d="M ${WIDTH - 80} 80 L ${WIDTH - 80} 110 M ${WIDTH - 80} 80 L ${WIDTH - 110} 80" stroke="#C5A55A" stroke-width="1.5" fill="none" opacity="0.15"/>`,
    `<path d="M 80 ${HEIGHT - 80} L 80 ${HEIGHT - 110} M 80 ${HEIGHT - 80} L 110 ${HEIGHT - 80}" stroke="#C5A55A" stroke-width="1.5" fill="none" opacity="0.15"/>`,
    `<path d="M ${WIDTH - 80} ${HEIGHT - 80} L ${WIDTH - 80} ${HEIGHT - 110} M ${WIDTH - 80} ${HEIGHT - 80} L ${WIDTH - 110} ${HEIGHT - 80}" stroke="#C5A55A" stroke-width="1.5" fill="none" opacity="0.15"/>`,

    // Space for logo (composited separately) — logo at y=50 to y=190

    // Arabic brand name — large, bold, prominent
    `<text x="${WIDTH / 2}" y="265" text-anchor="middle" font-size="80" font-weight="900" fill="#ffffff" font-family="Noto Sans Arabic">${esc("المفتاح الشهري")}</text>`,

    // Gold separator line
    `<rect x="${WIDTH / 2 - 80}" y="290" width="160" height="2" fill="url(#gold)"/>`,

    // English brand name — elegant, spaced
    `<text x="${WIDTH / 2}" y="335" text-anchor="middle" font-size="22" fill="#C5A55A" font-family="Noto Sans" letter-spacing="8" font-weight="600">MONTHLY KEY</text>`,

    // Tagline
    `<text x="${WIDTH / 2}" y="390" text-anchor="middle" font-size="26" fill="#8899B0" font-family="Noto Sans Arabic" font-weight="400">${esc("منصة التأجير الشهري الرائدة في السعودية")}</text>`,

    // Property types with gold dots
    `<text x="${WIDTH / 2}" y="445" text-anchor="middle" font-size="20" fill="#C5A55A" font-family="Noto Sans Arabic" opacity="0.8">${esc("شقق مفروشة  ●  استوديوهات  ●  فلل  ●  دوبلكس  ●  شقق فندقية")}</text>`,

    // Decorative dots — centered
    `<circle cx="${WIDTH / 2 - 30}" cy="500" r="3" fill="#C5A55A" opacity="0.25"/>`,
    `<circle cx="${WIDTH / 2 - 10}" cy="500" r="3" fill="#C5A55A" opacity="0.45"/>`,
    `<circle cx="${WIDTH / 2 + 10}" cy="500" r="4" fill="#C5A55A" opacity="0.7"/>`,
    `<circle cx="${WIDTH / 2 + 30}" cy="500" r="3" fill="#C5A55A" opacity="0.45"/>`,
    `<circle cx="${WIDTH / 2 + 50}" cy="500" r="3" fill="#C5A55A" opacity="0.25"/>`,

    // Bottom teal accent line
    `<rect x="0" y="${HEIGHT - 3}" width="${WIDTH}" height="3" fill="url(#teal)"/>`,

    // Website URL — bottom center
    `<text x="${WIDTH / 2}" y="${HEIGHT - 25}" text-anchor="middle" font-size="14" fill="#4B5E78" font-family="Noto Sans" letter-spacing="4" font-weight="400">monthlykey.com</text>`,

    `</svg>`,
  ].join("");

  const buffer = await sharp(Buffer.from(svg))
    .composite(logoComposite)
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  setCache(cacheKey, buffer);
  return buffer;
}

const propertyTypeAr: Record<string, string> = {
  apartment: "شقة",
  villa: "فيلا",
  studio: "استوديو",
  duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة",
  compound: "مجمع سكني",
  hotel_apartment: "شقة فندقية",
};

interface PropertyOGData {
  id: number;
  titleAr: string;
  titleEn?: string;
  propertyType: string;
  cityAr?: string;
  districtAr?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  monthlyRent: string | number;
  photos?: string[] | string;
}

/**
 * Generate a property-specific OG image
 * If the property has a cover photo, use it as background with dark overlay.
 * Otherwise, generate a branded card with property details.
 */
export async function generatePropertyOG(prop: PropertyOGData): Promise<Buffer> {
  const cacheKey = `og:property:${prop.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Parse photos
  const photos: string[] = Array.isArray(prop.photos)
    ? prop.photos
    : typeof prop.photos === "string"
      ? JSON.parse(prop.photos || "[]")
      : [];
  const coverUrl = photos.find((p) => p && p.startsWith("http")) || "";

  let baseImage: Buffer;

  if (coverUrl) {
    // Try to fetch the cover photo and use it as background
    try {
      const response = await fetch(coverUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const imgBuf = Buffer.from(await response.arrayBuffer());
        // Resize to 1200x630, cover mode, then apply dark overlay
        baseImage = await sharp(imgBuf)
          .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
          .composite([
            {
              input: Buffer.from(
                `<svg width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="black" opacity="0.6"/></svg>`
              ),
              blend: "over",
            },
          ])
          .png()
          .toBuffer();
      } else {
        baseImage = await generatePropertyFallbackBG();
      }
    } catch {
      baseImage = await generatePropertyFallbackBG();
    }
  } else {
    baseImage = await generatePropertyFallbackBG();
  }

  // Build text overlay SVG
  const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
  const title = truncate(prop.titleAr || prop.titleEn || "عقار للإيجار", 40);
  const location = [prop.cityAr, prop.districtAr].filter(Boolean).join(" — ");
  const price = `${fmtPrice(prop.monthlyRent)} ر.س / شهر`;

  const highlights: string[] = [];
  if (prop.bedrooms) highlights.push(`${prop.bedrooms} غرف نوم`);
  if (prop.bathrooms) highlights.push(`${prop.bathrooms} حمامات`);
  if (prop.sizeSqm) highlights.push(`${prop.sizeSqm} م²`);
  const highlightText = highlights.join("  ●  ");

  let logoComposite: sharp.OverlayOptions[] = [];
  try {
    const logoPath = getLogoPath();
    if (fs.existsSync(logoPath)) {
      const logoBuf = await sharp(logoPath)
        .resize(60, 60, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      logoComposite = [{ input: logoBuf, top: HEIGHT - 80, left: WIDTH - 80 }];
    }
  } catch {}

  const overlaySvg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    // Top accent bar
    `<rect x="0" y="0" width="${WIDTH}" height="5" fill="#3ECFC0"/>`,
    // Property type badge
    `<rect x="40" y="40" width="${typeAr.length * 22 + 40}" height="44" rx="22" fill="#3ECFC0" opacity="0.9"/>`,
    `<text x="${40 + (typeAr.length * 22 + 40) / 2}" y="68" text-anchor="middle" font-size="20" font-weight="bold" fill="#0A1628" font-family="Noto Sans Arabic">${esc(typeAr)}</text>`,
    // Title
    `<text x="${WIDTH / 2}" y="240" text-anchor="middle" font-size="52" font-weight="bold" fill="#ffffff" font-family="Noto Sans Arabic">${esc(title)}</text>`,
    // Location
    location
      ? `<text x="${WIDTH / 2}" y="300" text-anchor="middle" font-size="26" fill="#D1D5DB" font-family="Noto Sans Arabic">${esc(location)}</text>`
      : "",
    // Price
    `<rect x="${WIDTH / 2 - 180}" y="340" width="360" height="56" rx="28" fill="#C5A55A" opacity="0.9"/>`,
    `<text x="${WIDTH / 2}" y="376" text-anchor="middle" font-size="28" font-weight="bold" fill="#0A1628" font-family="Noto Sans Arabic">${esc(price)}</text>`,
    // Highlights
    highlightText
      ? `<text x="${WIDTH / 2}" y="450" text-anchor="middle" font-size="22" fill="#E5E7EB" font-family="Noto Sans Arabic">${esc(highlightText)}</text>`
      : "",
    // Bottom branding bar
    `<rect x="0" y="${HEIGHT - 5}" width="${WIDTH}" height="5" fill="#C5A55A"/>`,
    // Branding text
    `<text x="40" y="${HEIGHT - 25}" font-size="16" fill="#9CA3AF" font-family="Noto Sans Arabic">المفتاح الشهري  |  monthlykey.com</text>`,
    `</svg>`,
  ].join("");

  const buffer = await sharp(baseImage)
    .composite([
      { input: Buffer.from(overlaySvg), blend: "over" },
      ...logoComposite,
    ])
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  setCache(cacheKey, buffer);
  return buffer;
}

/** Generate a branded fallback background for properties without photos */
async function generatePropertyFallbackBG(): Promise<Buffer> {
  const svg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" style="stop-color:#0A1628;stop-opacity:1" />`,
    `<stop offset="100%" style="stop-color:#1a2d4a;stop-opacity:1" />`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#pbg)"/>`,
    // Subtle pattern
    `<rect x="100" y="100" width="1000" height="430" rx="8" fill="none" stroke="#3ECFC0" stroke-width="1" opacity="0.1"/>`,
    `<rect x="110" y="110" width="980" height="410" rx="6" fill="none" stroke="#C5A55A" stroke-width="1" opacity="0.08"/>`,
    `</svg>`,
  ].join("");

  return sharp(Buffer.from(svg)).png().toBuffer();
}
