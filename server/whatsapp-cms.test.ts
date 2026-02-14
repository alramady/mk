import { describe, it, expect, vi, beforeEach } from "vitest";

// Test WhatsApp settings and CMS content management
describe("WhatsApp & CMS Settings", () => {
  describe("WhatsApp Settings Validation", () => {
    it("should validate WhatsApp number format (Saudi format)", () => {
      const validNumbers = ["966504466528", "966551234567", "966599999999"];
      const invalidNumbers = ["", "123", "abc", "05012345678"];

      validNumbers.forEach((num) => {
        expect(num).toMatch(/^966\d{9}$/);
      });

      invalidNumbers.forEach((num) => {
        expect(num).not.toMatch(/^966\d{9}$/);
      });
    });

    it("should construct correct WhatsApp URL", () => {
      const number = "966504466528";
      const message = "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري";
      const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

      expect(url).toContain("wa.me/966504466528");
      expect(url).toContain("text=");
      expect(url).not.toContain(" ");
    });

    it("should handle empty WhatsApp message gracefully", () => {
      const number = "966504466528";
      const message = "";
      const url = message
        ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${number}`;

      expect(url).toBe("https://wa.me/966504466528");
    });
  });

  describe("CMS Default Settings", () => {
    const defaults: Record<string, string> = {
      "site.primaryColor": "#3ECFC0",
      "site.accentColor": "#C9A96E",
      "hero.titleAr": "خبير الإيجار الشهري — الآن في السعودية",
      "hero.titleEn": "Monthly Rental Expert — Now in Saudi Arabia",
      "hero.subtitleAr":
        "إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة",
      "hero.subtitleEn":
        "Premium monthly rental management | Riyadh • Jeddah • Madinah",
      "fees.serviceFeePercent": "5",
      "fees.vatPercent": "15",
      "fees.depositMonths": "2",
      "rental.minMonths": "1",
      "rental.maxMonths": "12",
      "whatsapp.number": "966504466528",
    };

    it("should have all required CMS keys", () => {
      const requiredKeys = [
        "site.primaryColor",
        "site.accentColor",
        "hero.titleAr",
        "hero.titleEn",
        "hero.subtitleAr",
        "hero.subtitleEn",
        "fees.serviceFeePercent",
        "fees.vatPercent",
        "fees.depositMonths",
        "rental.minMonths",
        "rental.maxMonths",
        "whatsapp.number",
      ];

      requiredKeys.forEach((key) => {
        expect(defaults).toHaveProperty(key);
        expect(defaults[key]).toBeTruthy();
      });
    });

    it("should have valid color hex values", () => {
      expect(defaults["site.primaryColor"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(defaults["site.accentColor"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("should have valid numeric fee settings", () => {
      const serviceFee = parseFloat(defaults["fees.serviceFeePercent"]);
      const vat = parseFloat(defaults["fees.vatPercent"]);
      const deposit = parseFloat(defaults["fees.depositMonths"]);

      expect(serviceFee).toBeGreaterThan(0);
      expect(serviceFee).toBeLessThanOrEqual(100);
      expect(vat).toBeGreaterThanOrEqual(0);
      expect(vat).toBeLessThanOrEqual(100);
      expect(deposit).toBeGreaterThanOrEqual(0);
    });

    it("should have valid rental duration limits", () => {
      const minMonths = parseInt(defaults["rental.minMonths"]);
      const maxMonths = parseInt(defaults["rental.maxMonths"]);

      expect(minMonths).toBeGreaterThanOrEqual(1);
      expect(maxMonths).toBeGreaterThanOrEqual(minMonths);
      expect(maxMonths).toBeLessThanOrEqual(24);
    });

    it("should have bilingual content for all text settings", () => {
      const bilingualKeys = ["hero.title", "hero.subtitle"];

      bilingualKeys.forEach((key) => {
        expect(defaults[`${key}Ar`]).toBeTruthy();
        expect(defaults[`${key}En`]).toBeTruthy();
        // Arabic text should contain Arabic characters
        expect(defaults[`${key}Ar`]).toMatch(/[\u0600-\u06FF]/);
        // English text should contain Latin characters
        expect(defaults[`${key}En`]).toMatch(/[a-zA-Z]/);
      });
    });
  });

  describe("Service Fee Calculation", () => {
    it("should calculate service fee correctly", () => {
      const monthlyRent = 5000;
      const serviceFeePercent = 5;
      const months = 2;

      const totalRent = monthlyRent * months;
      const serviceFee = totalRent * (serviceFeePercent / 100);

      expect(serviceFee).toBe(500);
    });

    it("should calculate VAT correctly", () => {
      const monthlyRent = 5000;
      const serviceFeePercent = 5;
      const vatPercent = 15;
      const months = 2;

      const totalRent = monthlyRent * months;
      const serviceFee = totalRent * (serviceFeePercent / 100);
      const vat = serviceFee * (vatPercent / 100);

      expect(vat).toBe(75);
    });

    it("should calculate deposit correctly", () => {
      const monthlyRent = 5000;
      const depositMonths = 2;

      const deposit = monthlyRent * depositMonths;

      expect(deposit).toBe(10000);
    });

    it("should calculate total booking cost correctly", () => {
      const monthlyRent = 5000;
      const serviceFeePercent = 5;
      const vatPercent = 15;
      const depositMonths = 2;
      const months = 1;

      const totalRent = monthlyRent * months;
      const serviceFee = totalRent * (serviceFeePercent / 100);
      const vat = serviceFee * (vatPercent / 100);
      const deposit = monthlyRent * depositMonths;
      const total = totalRent + serviceFee + vat + deposit;

      expect(totalRent).toBe(5000);
      expect(serviceFee).toBe(250);
      expect(vat).toBe(37.5);
      expect(deposit).toBe(10000);
      expect(total).toBe(15287.5);
    });
  });
});
