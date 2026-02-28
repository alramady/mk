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

    console.log('[FixColumns] Done');
  } catch (err) {
    console.error('[FixColumns] Connection error:', err.message);
    // Don't fail the boot — drizzle-kit will handle it or the app will report the error
  } finally {
    if (conn) await conn.end();
  }
}

main();
