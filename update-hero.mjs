// One-time script to update hero settings in the database to use the new Riyadh+Ramadan image
// Run: node update-hero.mjs (requires DATABASE_URL env var)
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const updates = {
  "hero.bgImage": "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=1600",
  "hero.bgType": "image",
  "hero.bgVideo": "",
  "hero.overlayOpacity": "35",
};

async function main() {
  for (const [key, value] of Object.entries(updates)) {
    await sql`UPDATE settings SET value = ${value} WHERE key = ${key}`;
    console.log(`Updated ${key} = ${value.substring(0, 60)}...`);
  }
  console.log("Done! Hero settings updated to use new Riyadh+Ramadan image.");
}

main().catch(console.error);
