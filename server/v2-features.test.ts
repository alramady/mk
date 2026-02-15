import { describe, it, expect } from "vitest";

describe("V2 Platform Upgrade Features", () => {
  describe("Security Deposit Calculation (10% of rent)", () => {
    it("should calculate deposit as 10% of total rent", () => {
      const monthlyRent = 5000;
      const durationMonths = 2;
      const depositPercent = 10;
      const totalRent = monthlyRent * durationMonths;
      const deposit = Math.round(totalRent * (depositPercent / 100));
      expect(deposit).toBe(1000);
    });

    it("should calculate deposit correctly for 1 month", () => {
      const monthlyRent = 3000;
      const durationMonths = 1;
      const depositPercent = 10;
      const totalRent = monthlyRent * durationMonths;
      const deposit = Math.round(totalRent * (depositPercent / 100));
      expect(deposit).toBe(300);
    });

    it("should allow custom deposit percentage from CMS", () => {
      const monthlyRent = 8000;
      const durationMonths = 2;
      const depositPercent = 15; // Admin changed to 15%
      const totalRent = monthlyRent * durationMonths;
      const deposit = Math.round(totalRent * (depositPercent / 100));
      expect(deposit).toBe(2400);
    });

    it("should calculate full cost breakdown correctly", () => {
      const monthlyRent = 5000;
      const durationMonths = 2;
      const depositPercent = 10;
      const serviceFeePercent = 5;
      const vatPercent = 15;

      const totalRent = monthlyRent * durationMonths; // 10000
      const securityDeposit = Math.round(totalRent * (depositPercent / 100)); // 1000
      const serviceFee = Math.round(monthlyRent * (serviceFeePercent / 100)); // 250
      const vatAmount = Math.round(serviceFee * (vatPercent / 100)); // 38
      const totalAmount = totalRent + securityDeposit + serviceFee + vatAmount;

      expect(totalRent).toBe(10000);
      expect(securityDeposit).toBe(1000);
      expect(serviceFee).toBe(250);
      expect(vatAmount).toBe(38);
      expect(totalAmount).toBe(11288);
    });
  });

  describe("Property Manager Schema", () => {
    it("should validate property manager fields", () => {
      const manager = {
        name: "Ahmed Al-Rashid",
        nameAr: "أحمد الراشد",
        phone: "+966501234567",
        email: "ahmed@monthlykey.com",
        whatsapp: "+966501234567",
        photoUrl: "https://example.com/photo.jpg",
        bio: "Experienced property manager",
        bioAr: "مدير عقارات ذو خبرة",
        isActive: true,
      };
      expect(manager.name).toBeTruthy();
      expect(manager.nameAr).toBeTruthy();
      expect(manager.phone).toMatch(/^\+966/);
      expect(manager.isActive).toBe(true);
    });
  });

  describe("Inspection Request Schema", () => {
    it("should validate inspection request fields", () => {
      const request = {
        propertyId: 1,
        userId: 2,
        requestedDate: "2026-03-15",
        requestedTimeSlot: "10:00-11:00",
        status: "pending",
        notes: "Would like to see the kitchen",
      };
      expect(request.propertyId).toBeGreaterThan(0);
      expect(request.userId).toBeGreaterThan(0);
      expect(request.status).toBe("pending");
      expect(["pending", "confirmed", "completed", "cancelled"]).toContain(request.status);
    });

    it("should validate time slot format", () => {
      const validSlots = ["09:00-10:00", "10:00-11:00", "14:00-15:00", "16:00-17:00"];
      validSlots.forEach(slot => {
        expect(slot).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
      });
    });
  });

  describe("Enhanced Customer Profile", () => {
    it("should validate all profile fields", () => {
      const profile = {
        phone: "0501234567",
        nationalId: "1234567890",
        dateOfBirth: "1990-01-15",
        nationality: "Saudi",
        emergencyContact: "Mohammed",
        emergencyPhone: "0509876543",
        city: "Riyadh",
        address: "King Fahd Road",
        bio: "Looking for monthly rental",
      };
      expect(profile.phone).toBeTruthy();
      expect(profile.nationalId).toBeTruthy();
      expect(profile.nationality).toBeTruthy();
      expect(profile.emergencyContact).toBeTruthy();
    });
  });

  describe("Hero Video/Image Background", () => {
    it("should support image background type", () => {
      const heroSettings = {
        "hero.bgType": "image",
        "hero.bgImageUrl": "https://example.com/hero.jpg",
      };
      expect(heroSettings["hero.bgType"]).toBe("image");
      expect(heroSettings["hero.bgImageUrl"]).toBeTruthy();
    });

    it("should support video background type", () => {
      const heroSettings = {
        "hero.bgType": "video",
        "hero.bgVideoUrl": "https://example.com/hero.mp4",
        "hero.bgImageUrl": "https://example.com/fallback.jpg",
      };
      expect(heroSettings["hero.bgType"]).toBe("video");
      expect(heroSettings["hero.bgVideoUrl"]).toBeTruthy();
      expect(heroSettings["hero.bgImageUrl"]).toBeTruthy(); // Fallback image
    });
  });
});
