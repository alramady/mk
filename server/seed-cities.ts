import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { cities, districts, roles } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { ENV } from "./_core/env";

/**
 * Seed cities and districts for Saudi Arabia
 * Called on server startup to ensure data is available
 */
export async function seedCitiesAndDistricts() {
  const pool = mysql.createPool(ENV.databaseUrl);
  const db = drizzle(pool);

  try {
    // Check if cities already seeded
    const [cityCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(cities);
    if (cityCount.count >= 6) {
      console.log("[Seed] Cities already seeded, skipping.");
      await seedDefaultRoles(db);
      return;
    }

    // ─── Cities ──────────────────────────────────────────────────────
    const cityData = [
      { nameEn: "Riyadh", nameAr: "الرياض", region: "Riyadh", regionAr: "منطقة الرياض", latitude: "24.7136", longitude: "46.6753", sortOrder: 1, isActive: true, imageUrl: "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80" },
      { nameEn: "Jeddah", nameAr: "جدة", region: "Makkah", regionAr: "منطقة مكة المكرمة", latitude: "21.5433", longitude: "39.1728", sortOrder: 2, isActive: false, imageUrl: "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80" },
      { nameEn: "Madinah", nameAr: "المدينة المنورة", region: "Madinah", regionAr: "منطقة المدينة المنورة", latitude: "24.4539", longitude: "39.6142", sortOrder: 3, isActive: false, imageUrl: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&q=80" },
      { nameEn: "Makkah", nameAr: "مكة المكرمة", region: "Makkah", regionAr: "منطقة مكة المكرمة", latitude: "21.3891", longitude: "39.8579", sortOrder: 4, isActive: false, imageUrl: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&q=80" },
      { nameEn: "Dammam", nameAr: "الدمام", region: "Eastern", regionAr: "المنطقة الشرقية", latitude: "26.4207", longitude: "50.0888", sortOrder: 5, isActive: false, imageUrl: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80" },
      { nameEn: "Khobar", nameAr: "الخبر", region: "Eastern", regionAr: "المنطقة الشرقية", latitude: "26.2172", longitude: "50.1971", sortOrder: 6, isActive: false, imageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
      { nameEn: "Tabuk", nameAr: "تبوك", region: "Tabuk", regionAr: "منطقة تبوك", latitude: "28.3838", longitude: "36.5550", sortOrder: 7, isActive: false, imageUrl: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80" },
      { nameEn: "Abha", nameAr: "أبها", region: "Asir", regionAr: "منطقة عسير", latitude: "18.2164", longitude: "42.5053", sortOrder: 8, isActive: false, imageUrl: "https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=800&q=80" },
    ];

    for (const city of cityData) {
      const existing = await db.select().from(cities).where(eq(cities.nameEn, city.nameEn));
      if (existing.length === 0) {
        await db.insert(cities).values(city as any);
        console.log(`[Seed] City '${city.nameEn}' created.`);
      }
    }

    // Get city IDs
    const allCities = await db.select().from(cities);
    const cityMap = new Map(allCities.map(c => [c.nameEn, c.id]));

    // ─── Districts ───────────────────────────────────────────────────
    const districtData: Array<{ city: string; cityAr: string; cityId: number; nameEn: string; nameAr: string; latitude?: string; longitude?: string }> = [
      // Riyadh
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Olaya", nameAr: "العليا", latitude: "24.6900", longitude: "46.6850" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Malaz", nameAr: "الملز", latitude: "24.6600", longitude: "46.7300" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Sulaimaniyah", nameAr: "السليمانية", latitude: "24.6950", longitude: "46.6700" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Yasmin", nameAr: "الياسمين", latitude: "24.8200", longitude: "46.6400" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Nakheel", nameAr: "النخيل", latitude: "24.7700", longitude: "46.6300" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "24.7100", longitude: "46.7400" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Muruj", nameAr: "المروج", latitude: "24.7500", longitude: "46.6500" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Sahafah", nameAr: "الصحافة", latitude: "24.8100", longitude: "46.6600" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "24.6800", longitude: "46.7200" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Wurud", nameAr: "الورود", latitude: "24.7000", longitude: "46.6700" },

      // Jeddah
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "21.5800", longitude: "39.1600" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Salamah", nameAr: "السلامة", latitude: "21.5700", longitude: "39.1500" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Hamra", nameAr: "الحمراء", latitude: "21.5500", longitude: "39.1700" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Zahra", nameAr: "الزهراء", latitude: "21.5600", longitude: "39.1400" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Andalus", nameAr: "الأندلس", latitude: "21.5400", longitude: "39.1300" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Shati", nameAr: "الشاطئ", latitude: "21.5900", longitude: "39.1100" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Marwah", nameAr: "المروة", latitude: "21.5300", longitude: "39.1800" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Safa", nameAr: "الصفا", latitude: "21.5650", longitude: "39.1550" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Naeem", nameAr: "النعيم", latitude: "21.5750", longitude: "39.1650" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Mohammadiyah", nameAr: "المحمدية", latitude: "21.5850", longitude: "39.1250" },

      // Madinah
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Haram", nameAr: "الحرم", latitude: "24.4672", longitude: "39.6112" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Quba", nameAr: "قباء", latitude: "24.4400", longitude: "39.6200" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "24.4500", longitude: "39.6000" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Iskan", nameAr: "الإسكان", latitude: "24.4300", longitude: "39.5900" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Khalidiyah", nameAr: "الخالدية", latitude: "24.4600", longitude: "39.5800" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Uyun", nameAr: "العيون", latitude: "24.4700", longitude: "39.5700" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Uhud", nameAr: "أحد", latitude: "24.4900", longitude: "39.6100" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "24.4800", longitude: "39.6300" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Nuzha", nameAr: "النزهة", latitude: "24.4550", longitude: "39.6050" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Bani Bayada", nameAr: "بني بياضة", latitude: "24.4650", longitude: "39.5950" },

      // Makkah
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "21.4000", longitude: "39.8400" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Shawqiyah", nameAr: "الشوقية", latitude: "21.4100", longitude: "39.8200" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Naseem", nameAr: "النسيم", latitude: "21.3800", longitude: "39.8700" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Awali", nameAr: "العوالي", latitude: "21.3700", longitude: "39.8800" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Rusayfah", nameAr: "الرصيفة", latitude: "21.3900", longitude: "39.8300" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Zahir", nameAr: "الزاهر", latitude: "21.3950", longitude: "39.8500" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Hamra", nameAr: "الحمراء", latitude: "21.4050", longitude: "39.8600" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Batha Quraysh", nameAr: "بطحاء قريش", latitude: "21.3850", longitude: "39.8450" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Kakiyah", nameAr: "الكعكية", latitude: "21.4150", longitude: "39.8350" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Hijrah", nameAr: "الهجرة", latitude: "21.3750", longitude: "39.8550" },

      // Dammam
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Faisaliyah", nameAr: "الفيصلية", latitude: "26.4300", longitude: "50.1000" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Shati", nameAr: "الشاطئ", latitude: "26.4400", longitude: "50.1200" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Mazrouiyah", nameAr: "المزروعية", latitude: "26.4100", longitude: "50.0900" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Jalawiyah", nameAr: "الجلوية", latitude: "26.4200", longitude: "50.0800" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Anwar", nameAr: "الأنوار", latitude: "26.4000", longitude: "50.0700" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Khaleej", nameAr: "الخليج", latitude: "26.4500", longitude: "50.1100" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Firdaws", nameAr: "الفردوس", latitude: "26.3900", longitude: "50.0600" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Nada", nameAr: "الندى", latitude: "26.4350", longitude: "50.0950" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "26.4150", longitude: "50.0850" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Rayyan", nameAr: "الريان", latitude: "26.4050", longitude: "50.0750" },

      // Khobar
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Hizam Al Dhahabi", nameAr: "الحزام الذهبي", latitude: "26.2800", longitude: "50.2100" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Aqrabiyah", nameAr: "العقربية", latitude: "26.2700", longitude: "50.2000" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "North Khobar", nameAr: "الخبر الشمالية", latitude: "26.2900", longitude: "50.2200" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "South Khobar", nameAr: "الخبر الجنوبية", latitude: "26.2100", longitude: "50.1900" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Thuqbah", nameAr: "الثقبة", latitude: "26.2500", longitude: "50.2050" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Rakah", nameAr: "الراكة", latitude: "26.2600", longitude: "50.2150" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Yarmouk", nameAr: "اليرموك", latitude: "26.2400", longitude: "50.1950" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Safa", nameAr: "الصفا", latitude: "26.2300", longitude: "50.1850" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Bandariyah", nameAr: "البندرية", latitude: "26.2200", longitude: "50.2250" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Tahliyah", nameAr: "التحلية", latitude: "26.2750", longitude: "50.2080" },

      // Tabuk
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Faisaliyah", nameAr: "الفيصلية", latitude: "28.3900", longitude: "36.5600" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Muruj", nameAr: "المروج", latitude: "28.3800", longitude: "36.5500" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Sulaimaniyah", nameAr: "السليمانية", latitude: "28.3700", longitude: "36.5400" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "28.3950", longitude: "36.5650" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Nakheel", nameAr: "النخيل", latitude: "28.3750", longitude: "36.5450" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Wurud", nameAr: "الورود", latitude: "28.3850", longitude: "36.5550" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Masif", nameAr: "المصيف", latitude: "28.4000", longitude: "36.5700" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "28.3650", longitude: "36.5350" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "28.3550", longitude: "36.5250" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rayyan", nameAr: "الريان", latitude: "28.4050", longitude: "36.5750" },

      // Abha
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Mansak", nameAr: "المنسك", latitude: "18.2200", longitude: "42.5100" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Khalidiyah", nameAr: "الخالدية", latitude: "18.2300", longitude: "42.5200" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "18.2100", longitude: "42.5000" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Miftahah", nameAr: "المفتاحة", latitude: "18.2250", longitude: "42.5050" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Dhubab", nameAr: "الضباب", latitude: "18.2350", longitude: "42.5150" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Naseem", nameAr: "النسيم", latitude: "18.2050", longitude: "42.4950" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Wardatain", nameAr: "الوردتين", latitude: "18.2150", longitude: "42.5250" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Muwadhafeen", nameAr: "الموظفين", latitude: "18.2000", longitude: "42.4900" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Shamsan", nameAr: "شمسان", latitude: "18.2400", longitude: "42.5300" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Sadd", nameAr: "السد", latitude: "18.1950", longitude: "42.4850" },
    ];

    // Insert districts in batches
    const batchSize = 20;
    for (let i = 0; i < districtData.length; i += batchSize) {
      const batch = districtData.slice(i, i + batchSize);
      await db.insert(districts).values(batch as any[]);
    }
    console.log(`[Seed] ${districtData.length} districts seeded across 8 cities.`);

    // Seed default roles
    await seedDefaultRoles(db);

  } catch (error) {
    console.error("[Seed] Error seeding cities/districts:", error);
  }
}

async function seedDefaultRoles(db: ReturnType<typeof drizzle>) {
  try {
    const [roleCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(roles);
    if (roleCount.count > 0) {
      console.log("[Seed] Roles already seeded, skipping.");
      return;
    }

    const defaultRoles = [
      {
        name: "Super Admin",
        nameAr: "مدير عام",
        description: "Full system access with all permissions",
        descriptionAr: "صلاحيات كاملة للنظام",
        permissions: JSON.stringify([
          "properties.view", "properties.create", "properties.edit", "properties.delete",
          "bookings.view", "bookings.create", "bookings.approve", "bookings.cancel",
          "users.view", "users.edit", "users.delete", "users.roles",
          "payments.view", "payments.process",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
          "settings.view", "settings.edit",
          "analytics.view",
          "notifications.send",
          "cms.edit",
        ]),
        isSystem: true,
      },
      {
        name: "Property Manager",
        nameAr: "مدير عقارات",
        description: "Manage properties, bookings, and tenants",
        descriptionAr: "إدارة العقارات والحجوزات والمستأجرين",
        permissions: JSON.stringify([
          "properties.view", "properties.create", "properties.edit",
          "bookings.view", "bookings.approve", "bookings.cancel",
          "users.view",
          "payments.view",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
        ]),
        isSystem: true,
      },
      {
        name: "Accountant",
        nameAr: "محاسب",
        description: "View and manage financial records",
        descriptionAr: "عرض وإدارة السجلات المالية",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "payments.view", "payments.process",
          "analytics.view",
        ]),
        isSystem: true,
      },
      {
        name: "Support Agent",
        nameAr: "موظف دعم",
        description: "Handle service requests and maintenance",
        descriptionAr: "معالجة طلبات الخدمات والصيانة",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "users.view",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
        ]),
        isSystem: true,
      },
      {
        name: "Viewer",
        nameAr: "مشاهد",
        description: "Read-only access to the system",
        descriptionAr: "صلاحية عرض فقط",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "users.view",
          "payments.view",
          "analytics.view",
        ]),
        isSystem: true,
      },
    ];

    for (const role of defaultRoles) {
      await db.insert(roles).values(role as any);
    }
    console.log(`[Seed] ${defaultRoles.length} default roles seeded.`);
  } catch (error) {
    console.error("[Seed] Error seeding roles:", error);
  }
}
