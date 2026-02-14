import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-test",
      email: "user@test.com",
      name: "User",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("Cities & Districts Management", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());

  describe("Cities", () => {
    it("should list all cities (public)", async () => {
      const cities = await userCaller.cities.all({ activeOnly: false });
      expect(Array.isArray(cities)).toBe(true);
    });

    it("should list only active cities when activeOnly is true", async () => {
      const cities = await userCaller.cities.all({ activeOnly: true });
      expect(Array.isArray(cities)).toBe(true);
      // All returned cities should be active
      for (const city of cities) {
        expect(city.isActive).toBe(true);
      }
    });

    it("should create a city (admin only)", async () => {
      const result = await adminCaller.cities.create({
        nameAr: "مدينة اختبار",
        nameEn: "Test City",
        region: "Test Region",
        regionAr: "منطقة اختبار",
        latitude: "25.0",
        longitude: "45.0",
        imageUrl: "",
        sortOrder: 99,
        isActive: true,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);

      // Verify via byId
      const city = await adminCaller.cities.byId({ id: result.id });
      expect(city?.nameEn).toBe("Test City");
      expect(city?.nameAr).toBe("مدينة اختبار");
    });

    it("should toggle city active status (admin only)", async () => {
      // Get the test city
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Test City");
      expect(testCity).toBeDefined();

      // Toggle to inactive
      const result = await adminCaller.cities.toggle({ id: testCity!.id, isActive: false });
      expect(result.success).toBe(true);

      // Verify it's inactive
      const updated = await adminCaller.cities.byId({ id: testCity!.id });
      expect(updated?.isActive).toBe(false);

      // Toggle back to active
      await adminCaller.cities.toggle({ id: testCity!.id, isActive: true });
    });

    it("should update a city (admin only)", async () => {
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Test City");
      expect(testCity).toBeDefined();

      const result = await adminCaller.cities.update({
        id: testCity!.id,
        nameAr: "مدينة اختبار محدثة",
        nameEn: "Updated Test City",
        region: "Updated Region",
        regionAr: "منطقة محدثة",
        latitude: "26.0",
        longitude: "46.0",
        imageUrl: "",
        sortOrder: 100,
        isActive: true,
      });
      expect(result.success).toBe(true);

      const updated = await adminCaller.cities.byId({ id: testCity!.id });
      expect(updated?.nameEn).toBe("Updated Test City");
    });

    it("should delete a city (admin only)", async () => {
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Updated Test City");
      expect(testCity).toBeDefined();

      const result = await adminCaller.cities.delete({ id: testCity!.id });
      expect(result.success).toBe(true);
    });
  });

  describe("Districts", () => {
    it("should list all districts (public)", async () => {
      const districts = await userCaller.districts.all({ activeOnly: false });
      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBeGreaterThan(0);
    });

    it("should list only active districts", async () => {
      const districts = await userCaller.districts.all({ activeOnly: true });
      expect(Array.isArray(districts)).toBe(true);
      for (const d of districts) {
        expect(d.isActive).toBe(true);
      }
    });

    it("should filter districts by city", async () => {
      const districts = await userCaller.districts.byCity({ city: "Riyadh" });
      expect(Array.isArray(districts)).toBe(true);
      for (const d of districts) {
        expect(d.city).toBe("Riyadh");
      }
    });

    it("should create a district (admin only)", async () => {
      const result = await adminCaller.districts.create({
        cityId: 1,
        city: "Riyadh",
        cityAr: "الرياض",
        nameAr: "حي اختبار",
        nameEn: "Test District",
        latitude: "24.7",
        longitude: "46.7",
        sortOrder: 999,
        isActive: true,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);

      // Verify via byId
      const district = await adminCaller.districts.byId({ id: result.id });
      expect(district?.nameEn).toBe("Test District");
    });

    it("should toggle district active status (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.toggle({ id: testDistrict!.id, isActive: false });
      expect(result.success).toBe(true);

      // Verify inactive
      const updated = await adminCaller.districts.byId({ id: testDistrict!.id });
      expect(updated?.isActive).toBe(false);

      // Toggle back
      await adminCaller.districts.toggle({ id: testDistrict!.id, isActive: true });
    });

    it("should update a district (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.update({
        id: testDistrict!.id,
        cityId: 1,
        city: "Riyadh",
        cityAr: "الرياض",
        nameAr: "حي اختبار محدث",
        nameEn: "Updated Test District",
        latitude: "24.8",
        longitude: "46.8",
        sortOrder: 1000,
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("should delete a district (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Updated Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.delete({ id: testDistrict!.id });
      expect(result.success).toBe(true);
    });
  });
});
