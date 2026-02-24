import bcrypt from "bcryptjs";
import * as db from "./db";
import { nanoid } from "nanoid";

/**
 * Seeds the default admin user if not already present.
 * Called on server startup to ensure admin access is always available.
 */
export async function seedAdminUser() {
  try {
    // Seed demo property manager
    await seedDemoPropertyManager();

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
      // Grant full root admin permissions
      const allPermissions = [
        "manage_users", "manage_properties", "manage_bookings", "manage_payments",
        "manage_services", "manage_maintenance", "manage_cms", "manage_cities",
        "manage_knowledge", "manage_roles", "manage_settings", "view_analytics",
        "send_notifications", "manage_ai"
      ];
      await db.setAdminPermissions(id, allPermissions, true);
      console.log("[Seed] Root admin permissions granted to 'Hobart'");
    } else {
      console.error("[Seed] Failed to create admin user");
    }

    // Also ensure any existing admin users have permissions
    await ensureAdminPermissions();
  } catch (error) {
    console.error("[Seed] Error seeding admin user:", error);
  }
}

async function ensureAdminPermissions() {
  try {
    const allPermissions = [
      "manage_users", "manage_properties", "manage_bookings", "manage_payments",
      "manage_services", "manage_maintenance", "manage_cms", "manage_cities",
      "manage_knowledge", "manage_roles", "manage_settings", "view_analytics",
      "send_notifications", "manage_ai"
    ];
    // Check specific known admin users
    const knownAdmins = ["Hobart", "admin"];
    for (const userId of knownAdmins) {
      const user = await db.getUserByUserId(userId);
      if (user && user.role === "admin") {
        const existing = await db.getAdminPermissions(user.id);
        if (!existing) {
          await db.setAdminPermissions(user.id, allPermissions, true);
          console.log(`[Seed] Root admin permissions granted to '${userId}' (id: ${user.id})`);
        }
      }
    }
  } catch (error) {
    console.error("[Seed] Error ensuring admin permissions:", error);
  }
}

async function seedDemoPropertyManager() {
  try {
    const existing = await db.getManagerByEmail("mohammed.alharbi@ijar.sa");
    if (existing) {
      console.log("[Seed] Demo property manager already exists, skipping.");
      return;
    }

    const editToken = nanoid(32);
    const id = await db.createPropertyManager({
      name: "Mohammed Al-Harbi",
      nameAr: "محمد الحربي",
      email: "mohammed.alharbi@ijar.sa",
      phone: "+966551234567",
      whatsapp: "+966551234567",
      title: "Senior Property Manager",
      titleAr: "مدير عقارات أول",
      bio: "Experienced property manager with over 8 years in the Saudi real estate market. Specialized in premium residential properties in Riyadh.",
      bioAr: "مدير عقارات ذو خبرة تتجاوز 8 سنوات في سوق العقارات السعودي. متخصص في العقارات السكنية المميزة في الرياض.",
      photoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296955420/dWvNldGBaBNuhgwJ.jpg",
      isActive: true,
      editToken,
    } as any);

    if (id) {
      console.log("[Seed] Demo property manager 'Mohammed Al-Harbi' created (id:", id, ")");
    }
  } catch (error) {
    console.error("[Seed] Error seeding demo property manager:", error);
  }
}
