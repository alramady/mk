#!/usr/bin/env node
/**
 * fix-columns.mjs — Safely add missing columns to production DB
 * Runs BEFORE drizzle-kit migrate to fix columns that migrations failed to add.
 * Each ALTER TABLE is wrapped in a try/catch so duplicate column errors are ignored.
 */
import mysql from 'mysql2/promise';

const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.log('[FixColumns] No DATABASE_URL, skipping');
  process.exit(0);
}

const fixes = [
  { table: 'properties', column: 'googleMapsUrl', definition: 'text DEFAULT NULL' },
  { table: 'property_submissions', column: 'googleMapsUrl', definition: 'text DEFAULT NULL' },
  { table: 'properties', column: 'locationSource', definition: "ENUM('MANUAL','GEOCODE','PIN') DEFAULT NULL" },
  { table: 'properties', column: 'locationVisibility', definition: "ENUM('EXACT','APPROXIMATE','HIDDEN') NOT NULL DEFAULT 'APPROXIMATE'" },
  { table: 'properties', column: 'placeId', definition: 'varchar(255) DEFAULT NULL' },
  { table: 'properties', column: 'geocodeProvider', definition: 'varchar(20) DEFAULT NULL' },
  { table: 'properties', column: 'geocodeLastCheckedAt', definition: 'timestamp DEFAULT NULL' },
];

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(url);
    console.log('[FixColumns] Connected to database');

    for (const fix of fixes) {
      try {
        await conn.execute(`ALTER TABLE \`${fix.table}\` ADD COLUMN \`${fix.column}\` ${fix.definition}`);
        console.log(`[FixColumns] ✅ Added ${fix.column} to ${fix.table}`);
      } catch (err) {
        if (err.errno === 1060) {
          // ER_DUP_FIELDNAME — column already exists
          console.log(`[FixColumns] ⏭ ${fix.column} already exists in ${fix.table}`);
        } else {
          console.error(`[FixColumns] ❌ Failed to add ${fix.column} to ${fix.table}:`, err.message);
        }
      }
    }

    // Create geocode_cache table if it doesn't exist
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS \`geocode_cache\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`addressHash\` varchar(64) NOT NULL,
          \`provider\` varchar(20) NOT NULL DEFAULT 'google',
          \`lat\` decimal(10,7) NOT NULL,
          \`lng\` decimal(10,7) NOT NULL,
          \`placeId\` varchar(255) DEFAULT NULL,
          \`formattedAddress\` text DEFAULT NULL,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`expiresAt\` timestamp NOT NULL,
          \`hitCount\` int NOT NULL DEFAULT 0,
          CONSTRAINT \`geocode_cache_id\` PRIMARY KEY(\`id\`),
          CONSTRAINT \`geocode_cache_hash_provider\` UNIQUE(\`addressHash\`, \`provider\`)
        )
      `);
      console.log('[FixColumns] \u2705 geocode_cache table ensured');
    } catch (err) {
      if (err.errno === 1050) {
        console.log('[FixColumns] \u23ed geocode_cache table already exists');
      } else {
        console.error('[FixColumns] \u274c Failed to create geocode_cache:', err.message);
      }
    }

    // Add index on geocode_cache
    try {
      await conn.execute('CREATE INDEX `idx_geocode_cache_hash` ON `geocode_cache` (`addressHash`)');
      console.log('[FixColumns] \u2705 geocode_cache index created');
    } catch (err) {
      // Index may already exist
      console.log('[FixColumns] \u23ed geocode_cache index already exists or error:', err.message);
    }

    // Expand audit_log entityType for MAPS/GEOCODE
    try {
      await conn.execute("ALTER TABLE `audit_log` MODIFY COLUMN `entityType` ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','MAPS','GEOCODE') NOT NULL");
      console.log('[FixColumns] \u2705 audit_log entityType expanded');
    } catch (err) {
      console.log('[FixColumns] \u23ed audit_log entityType already expanded or error:', err.message);
    }

    // Expand audit_log action for GEOCODE/PIN_SET/OVERRIDE
    try {
      await conn.execute("ALTER TABLE `audit_log` MODIFY COLUMN `action` ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','GEOCODE','PIN_SET','OVERRIDE') NOT NULL");
      console.log('[FixColumns] \u2705 audit_log action expanded');
    } catch (err) {
      console.log('[FixColumns] \u23ed audit_log action already expanded or error:', err.message);
    }

    console.log('[FixColumns] Done');
  } catch (err) {
    console.error('[FixColumns] Connection error:', err.message);
    // Don't fail the boot — drizzle-kit will handle it or the app will report the error
  } finally {
    if (conn) await conn.end();
  }
}

main();
