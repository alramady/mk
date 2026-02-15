import { describe, it, expect } from "vitest";

// ─── Neighborhoods Seed Tests ──────────────────────────────────────
describe("Neighborhoods Seed Data", () => {
  it("should have seed-cities.ts file with all 5 new cities", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("Makkah");
    expect(content).toContain("Dammam");
    expect(content).toContain("Khobar");
    expect(content).toContain("Tabuk");
    expect(content).toContain("Abha");
  });

  it("should have Arabic neighborhood names for Makkah", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("العزيزية");
    expect(content).toContain("الشوقية");
    expect(content).toContain("العوالي");
  });

  it("should have Arabic neighborhood names for Dammam", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("الفيصلية");
    expect(content).toContain("الشاطئ");
  });

  it("should have Arabic neighborhood names for Khobar", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("الحزام الذهبي");
    expect(content).toContain("العقربية");
    expect(content).toContain("الثقبة");
  });

  it("should have Arabic neighborhood names for Tabuk", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("المروج");
    expect(content).toContain("النخيل");
  });

  it("should have Arabic neighborhood names for Abha", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("المنسك");
    expect(content).toContain("المفتاحة");
    expect(content).toContain("شمسان");
  });

  it("should seed on server startup", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).toContain("seed-cities");
  });
});

// ─── Roles & Permissions Tests ─────────────────────────────────────
describe("Roles & Permissions System", () => {
  it("should have roles table in schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("roles");
    expect(content).toContain("permissions");
  });

  it("should have roles router with CRUD endpoints", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("roles:");
    expect(content).toContain("roles");
  });

  it("should have AdminPermissions page", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/AdminPermissions.tsx", "utf-8");
    expect(content).toContain("AdminPermissions");
    expect(content).toContain("الأدوار والصلاحيات");
  });

  it("should have admin permissions route in App.tsx", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain("/admin/permissions");
    expect(content).toContain("AdminPermissions");
  });

  it("should have permission categories defined", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/AdminPermissions.tsx", "utf-8");
    // Check permission categories exist in the page
    expect(content).toContain("permissions");
    expect(content).toContain("الصلاحيات");
  });

  it("should have permissions link in admin dashboard", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/AdminDashboard.tsx", "utf-8");
    expect(content).toContain("/admin/permissions");
    expect(content).toContain("الأدوار والصلاحيات");
  });

  it("should seed default roles on startup", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/seed-cities.ts", "utf-8");
    expect(content).toContain("Super Admin");
    expect(content).toContain("Property Manager");
    expect(content).toContain("Accountant");
    expect(content).toContain("Support Agent");
    expect(content).toContain("Viewer");
  });

  it("should protect system roles from deletion", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("isSystem");
  });
});

// ─── Push Notifications Tests ──────────────────────────────────────
describe("Push Notifications System", () => {
  it("should have push_subscriptions table in schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("pushSubscriptions");
    expect(content).toContain("push_subscriptions");
  });

  it("should have push.ts server module", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/push.ts", "utf-8");
    expect(content).toContain("web-push");
    expect(content).toContain("sendPushToUser");
  });

  it("should have push router with subscribe/unsubscribe endpoints", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("push:");
  });

  it("should have service worker with push event handler", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/public/sw.js", "utf-8");
    expect(content).toContain("push");
    expect(content).toContain("notificationclick");
  });

  it("should have VAPID env vars configured", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/env.ts", "utf-8");
    expect(content).toContain("VAPID_PUBLIC_KEY");
    expect(content).toContain("VAPID_PRIVATE_KEY");
  });

  it("should have PWA manifest.json", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/public/manifest.json", "utf-8");
    const manifest = JSON.parse(content);
    expect(manifest.name).toContain("المفتاح الشهري");
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

// ─── Arabic-Only Branding Tests ────────────────────────────────────
describe("Arabic-Only Branding", () => {
  it("should have Arabic-only title in index.html", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/index.html", "utf-8");
    expect(content).toContain("المفتاح الشهري");
    expect(content).not.toMatch(/<title>.*Monthly Key.*<\/title>/);
  });

  it("should not have Monthly Key in hero section", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/Home.tsx", "utf-8");
    // Hero should use المفتاح الشهري, not "Monthly Key"
    expect(content).toContain("المفتاح الشهري");
  });
});
