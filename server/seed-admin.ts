import bcrypt from "bcryptjs";
import * as db from "./db";

/**
 * Seeds the default admin user if not already present.
 * Called on server startup to ensure admin access is always available.
 */
export async function seedAdminUser() {
  try {
    const existing = await db.getUserByUserId("Hobart");
    if (existing) {
      console.log("[Seed] Admin user 'Hobart' already exists, skipping.");
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash("15001500", salt);

    const id = await db.createLocalUser({
      userId: "Hobart",
      passwordHash,
      displayName: "Admin",
      name: "Khalid Abdullah",
      nameAr: "خالد عبدالله",
      email: "hobarti@protonmail.com",
      phone: "+966504466528",
      role: "admin",
    });

    if (id) {
      console.log("[Seed] Admin user 'Hobart' created successfully (id:", id, ")");
    } else {
      console.error("[Seed] Failed to create admin user");
    }
  } catch (error) {
    console.error("[Seed] Error seeding admin user:", error);
  }
}
