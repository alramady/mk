#!/usr/bin/env node
/**
 * fix-photos.mjs — One-time idempotent script to fix property photo URLs
 * in the existing database.
 *
 * PURPOSE:
 *   Replace broken /uploads/ paths and invalid photo URLs with stable
 *   CDN + Unsplash photo sets, grouped by property type.
 *
 * USAGE (Railway shell / manual only):
 *   npm run db:fix-photos
 *   — or —
 *   node scripts/fix-photos.mjs
 *
 * REQUIRES:
 *   DATABASE_URL environment variable (same as backend)
 *
 * SAFETY:
 *   - Idempotent: safe to rerun — skips properties that already have valid photos
 *   - Transactional: all updates succeed or all roll back
 *   - Read-only first: scans before writing, prints plan before executing
 *   - No schema changes, no migrations, no new tables
 *   - Does NOT run automatically on deploy
 *
 * DB COLUMN NAMES (from drizzle schema — camelCase in MySQL):
 *   id, titleAr, propertyType, photos (JSON column, string[])
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// ─── Photo URL Pools ────────────────────────────────────────────────────────

const CDN = {
  apt1: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/apt1.jpeg",
  apt2: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/apt2.jpeg",
  apt3: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/apt3.jpeg",
  villa1: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/villa1.jpg",
  villa2: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/villa2.jpg",
  villa3: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/villa3.webp",
  studio1: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/studio1.jpeg",
  studio2: "https://cdn.jsdelivr.net/gh/raneemndmo-collab/assets@main/properties/studio2.jpeg",
};

const U = {
  apt: [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop",
  ],
  villa: [
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
  ],
  studio: [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop",
  ],
  room: [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop",
  ],
  duplex: [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
  ],
  hotel: [
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop",
  ],
  compound: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if a single URL is "valid" (starts with https:// and is not a
 * local /uploads/ path or other broken pattern).
 */
function isValidPhotoUrl(url) {
  if (typeof url !== "string") return false;
  if (!url.startsWith("https://")) return false;
  if (url.includes("/uploads/")) return false;
  // Must be a real image host, not the app's own domain serving HTML
  return true;
}

/**
 * Check if the entire photos array for a property is healthy.
 * Returns true if ALL photos are valid https URLs.
 */
function photosAreHealthy(photos) {
  if (!Array.isArray(photos)) return false;
  if (photos.length < 3) return false; // We want at least 3 photos
  return photos.every(isValidPhotoUrl);
}

/**
 * Build a stable photo set for a given property type.
 * Uses the property ID as an offset to vary which photos are selected,
 * so not all apartments look identical.
 */
function buildPhotoSet(propertyType, id) {
  const offset = (id || 0) % 3;

  switch (propertyType) {
    case "apartment":
      return [
        CDN.apt1, CDN.apt2, CDN.apt3,
        U.apt[(offset) % U.apt.length],
        U.apt[(offset + 3) % U.apt.length],
        U.apt[(offset + 5) % U.apt.length],
        U.apt[(offset + 7) % U.apt.length],
      ];
    case "villa":
      return [
        CDN.villa1, CDN.villa2, CDN.villa3,
        U.villa[(offset) % U.villa.length],
        U.villa[(offset + 3) % U.villa.length],
        U.villa[(offset + 5) % U.villa.length],
        U.villa[(offset + 7) % U.villa.length],
      ];
    case "studio":
      return [
        CDN.studio1, CDN.studio2,
        U.studio[(offset) % U.studio.length],
        U.studio[(offset + 2) % U.studio.length],
        U.studio[(offset + 4) % U.studio.length],
        U.studio[(offset + 6) % U.studio.length],
      ];
    case "furnished_room":
      return [
        CDN.studio1, CDN.studio2,
        U.room[(offset) % U.room.length],
        U.room[(offset + 2) % U.room.length],
        U.room[(offset + 3) % U.room.length],
        U.room[(offset + 5) % U.room.length],
      ];
    case "duplex":
      return [
        CDN.villa1, CDN.villa2,
        U.duplex[(offset) % U.duplex.length],
        U.duplex[(offset + 2) % U.duplex.length],
        U.duplex[(offset + 4) % U.duplex.length],
        U.duplex[(offset + 6) % U.duplex.length],
      ];
    case "hotel_apartment":
      return [
        U.hotel[(offset) % U.hotel.length],
        U.hotel[(offset + 1) % U.hotel.length],
        U.hotel[(offset + 3) % U.hotel.length],
        U.hotel[(offset + 4) % U.hotel.length],
        U.hotel[(offset + 5) % U.hotel.length],
        U.hotel[(offset + 6) % U.hotel.length],
      ];
    case "compound":
      return [
        U.compound[(offset) % U.compound.length],
        U.compound[(offset + 1) % U.compound.length],
        U.compound[(offset + 3) % U.compound.length],
        U.compound[(offset + 4) % U.compound.length],
        U.compound[(offset + 5) % U.compound.length],
        U.compound[(offset + 6) % U.compound.length],
      ];
    default:
      // Fallback: apartment photos
      return [
        CDN.apt1, CDN.apt2, CDN.apt3,
        U.apt[0], U.apt[3], U.apt[5],
      ];
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const pool = mysql.createPool(process.env.DATABASE_URL);
  const startTime = Date.now();

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   📸 fix-photos.mjs — Property Photo Fixer      ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  // ── Phase 1: Scan ──────────────────────────────────────────────────────
  console.log("── Phase 1: Scanning properties ──\n");

  const [rows] = await pool.execute(
    "SELECT id, titleAr, propertyType, photos FROM properties ORDER BY id"
  );
  console.log(`📊 Found ${rows.length} properties in database\n`);

  const toUpdate = [];
  const toSkip = [];

  for (const row of rows) {
    let photos = row.photos;

    // Parse photos if it's a string (MySQL JSON column may return string)
    if (typeof photos === "string") {
      try {
        photos = JSON.parse(photos);
      } catch {
        photos = null;
      }
    }

    const healthy = photosAreHealthy(photos);
    const newPhotos = buildPhotoSet(row.propertyType, row.id);

    if (healthy) {
      toSkip.push({ id: row.id, title: row.titleAr, reason: "already healthy" });
      console.log(`  ⏭️  #${row.id} ${row.titleAr} — SKIP (${photos.length} valid photos)`);
    } else {
      const reason = !photos
        ? "null/invalid"
        : !Array.isArray(photos)
        ? "not an array"
        : photos.length < 3
        ? `only ${photos.length} photos`
        : photos.some(u => !isValidPhotoUrl(u))
        ? "contains broken URLs"
        : "unknown";
      toUpdate.push({ id: row.id, title: row.titleAr, type: row.propertyType, newPhotos, reason });
      console.log(`  🔧 #${row.id} ${row.titleAr} — NEEDS FIX (${reason}) → ${newPhotos.length} photos`);
    }
  }

  console.log(`\n── Phase 1 Summary ──`);
  console.log(`  Total scanned: ${rows.length}`);
  console.log(`  To update:     ${toUpdate.length}`);
  console.log(`  To skip:       ${toSkip.length}\n`);

  if (toUpdate.length === 0) {
    console.log("✅ All properties already have healthy photos. Nothing to do.");
    await pool.end();
    process.exit(0);
  }

  // ── Phase 2: Validate ─────────────────────────────────────────────────
  console.log("── Phase 2: Validating new photo sets ──\n");

  for (const item of toUpdate) {
    // Validate: must have 5+ photos, all https, first photo must be valid
    if (item.newPhotos.length < 5) {
      console.error(`❌ ABORT: Property #${item.id} would get only ${item.newPhotos.length} photos (need ≥5)`);
      await pool.end();
      process.exit(1);
    }
    if (!isValidPhotoUrl(item.newPhotos[0])) {
      console.error(`❌ ABORT: Property #${item.id} first photo is invalid: ${item.newPhotos[0]}`);
      await pool.end();
      process.exit(1);
    }
    if (!item.newPhotos.every(isValidPhotoUrl)) {
      console.error(`❌ ABORT: Property #${item.id} has invalid URLs in new set`);
      await pool.end();
      process.exit(1);
    }
    console.log(`  ✅ #${item.id} validated: ${item.newPhotos.length} photos, all https`);
  }

  console.log(`\n  All ${toUpdate.length} photo sets validated.\n`);

  // ── Phase 3: Update (transactional) ───────────────────────────────────
  console.log("── Phase 3: Updating database (transaction) ──\n");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const updatedIds = [];
    for (const item of toUpdate) {
      const photosJson = JSON.stringify(item.newPhotos);
      await conn.execute("UPDATE properties SET photos = ? WHERE id = ?", [photosJson, item.id]);
      updatedIds.push(item.id);
      console.log(`  ✅ #${item.id} ${item.title} → ${item.newPhotos.length} photos (was: ${item.reason})`);
    }

    await conn.commit();
    console.log(`\n  ✅ Transaction committed successfully.`);
    console.log(`  Updated IDs: [${updatedIds.join(", ")}]\n`);
  } catch (err) {
    await conn.rollback();
    console.error(`\n  ❌ Transaction ROLLED BACK due to error:`);
    console.error(`  ${err.message}\n`);
    conn.release();
    await pool.end();
    process.exit(1);
  }
  conn.release();

  // ── Phase 4: Verify ───────────────────────────────────────────────────
  console.log("── Phase 4: Verifying updates ──\n");

  const [verifyRows] = await pool.execute(
    "SELECT id, titleAr, photos FROM properties WHERE id IN (" +
      toUpdate.map(() => "?").join(",") +
    ") ORDER BY id",
    toUpdate.map(u => u.id)
  );

  let allGood = true;
  for (const row of verifyRows) {
    let photos = row.photos;
    if (typeof photos === "string") {
      try { photos = JSON.parse(photos); } catch { photos = null; }
    }
    const ok = photosAreHealthy(photos);
    if (ok) {
      console.log(`  ✅ #${row.id} ${row.titleAr} — verified (${photos.length} photos)`);
    } else {
      console.log(`  ❌ #${row.id} ${row.titleAr} — VERIFICATION FAILED`);
      allGood = false;
    }
  }

  // ── Final Summary ─────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║   📊 Final Summary                               ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Scanned:    ${String(rows.length).padEnd(36)}║`);
  console.log(`║  Updated:    ${String(toUpdate.length).padEnd(36)}║`);
  console.log(`║  Skipped:    ${String(toSkip.length).padEnd(36)}║`);
  console.log(`║  Verified:   ${String(allGood ? "✅ ALL OK" : "❌ ISSUES FOUND").padEnd(36)}║`);
  console.log(`║  Duration:   ${String(elapsed + "s").padEnd(36)}║`);
  console.log(`╚══════════════════════════════════════════════════╝`);

  await pool.end();
  process.exit(allGood ? 0 : 1);
}

main().catch(err => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
