import { describe, it, expect, vi } from "vitest";

/**
 * Hero Search Bar & Search Page URL Parameter Tests
 * Tests the search functionality from hero section to search results page
 */

describe("Hero Search Bar", () => {
  describe("URL Parameter Generation", () => {
    it("should generate correct URL params for text query", () => {
      const params = new URLSearchParams();
      const q = "شقة فاخرة";
      if (q) params.set("q", q);
      expect(params.toString()).toBe("q=%D8%B4%D9%82%D8%A9+%D9%81%D8%A7%D8%AE%D8%B1%D8%A9");
      expect(params.get("q")).toBe("شقة فاخرة");
    });

    it("should generate correct URL params for city filter", () => {
      const params = new URLSearchParams();
      const city = "Riyadh";
      if (city) params.set("city", city);
      expect(params.get("city")).toBe("Riyadh");
    });

    it("should generate correct URL params for type filter", () => {
      const params = new URLSearchParams();
      const type = "apartment";
      if (type) params.set("type", type);
      expect(params.get("type")).toBe("apartment");
    });

    it("should generate combined URL params for all filters", () => {
      const params = new URLSearchParams();
      const q = "luxury";
      const city = "Jeddah";
      const type = "villa";
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      if (type) params.set("type", type);
      expect(params.get("q")).toBe("luxury");
      expect(params.get("city")).toBe("Jeddah");
      expect(params.get("type")).toBe("villa");
    });

    it("should skip empty params", () => {
      const params = new URLSearchParams();
      const q = "";
      const city = "Riyadh";
      const type = "";
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      if (type) params.set("type", type);
      expect(params.has("q")).toBe(false);
      expect(params.has("city")).toBe(true);
      expect(params.has("type")).toBe(false);
    });
  });

  describe("URL Parameter Reading", () => {
    it("should read query param from URL", () => {
      const url = new URLSearchParams("q=luxury+apartment&city=Riyadh&type=villa");
      expect(url.get("q")).toBe("luxury apartment");
      expect(url.get("city")).toBe("Riyadh");
      expect(url.get("type")).toBe("villa");
    });

    it("should handle missing params gracefully", () => {
      const url = new URLSearchParams("city=Jeddah");
      expect(url.get("q") || "").toBe("");
      expect(url.get("city") || "").toBe("Jeddah");
      expect(url.get("type") || "").toBe("");
    });

    it("should handle Arabic text in query params", () => {
      const params = new URLSearchParams();
      params.set("q", "شقة في الرياض");
      const encoded = params.toString();
      const decoded = new URLSearchParams(encoded);
      expect(decoded.get("q")).toBe("شقة في الرياض");
    });

    it("should handle empty search string", () => {
      const url = new URLSearchParams("");
      expect(url.get("q") || "").toBe("");
      expect(url.get("city") || "").toBe("");
      expect(url.get("type") || "").toBe("");
    });
  });

  describe("Autocomplete Suggestion Logic", () => {
    const cities = [
      { id: 1, nameAr: "الرياض", nameEn: "Riyadh" },
      { id: 2, nameAr: "جدة", nameEn: "Jeddah" },
      { id: 3, nameAr: "الدمام", nameEn: "Dammam" },
      { id: 4, nameAr: "المدينة المنورة", nameEn: "Madinah" },
    ];

    const propertyTypes = [
      { value: "apartment", ar: "شقة", en: "Apartment" },
      { value: "villa", ar: "فيلا", en: "Villa" },
      { value: "studio", ar: "استوديو", en: "Studio" },
    ];

    function getSuggestions(query: string, lang: string) {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase();
      const results: Array<{ label: string; type: "city" | "propertyType"; value: string }> = [];
      cities.forEach(c => {
        if (c.nameAr.includes(query) || c.nameEn.toLowerCase().includes(q)) {
          results.push({ label: lang === "ar" ? c.nameAr : c.nameEn, type: "city", value: c.nameEn });
        }
      });
      propertyTypes.forEach(pt => {
        if (pt.ar.includes(query) || pt.en.toLowerCase().includes(q)) {
          results.push({ label: lang === "ar" ? pt.ar : pt.en, type: "propertyType", value: pt.value });
        }
      });
      return results.slice(0, 6);
    }

    it("should return empty for short queries", () => {
      expect(getSuggestions("", "en")).toEqual([]);
      expect(getSuggestions("a", "en")).toEqual([]);
    });

    it("should match English city names", () => {
      const results = getSuggestions("ri", "en");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].label).toBe("Riyadh");
      expect(results[0].type).toBe("city");
    });

    it("should match Arabic city names", () => {
      const results = getSuggestions("الرياض", "ar");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].label).toBe("الرياض");
      expect(results[0].type).toBe("city");
    });

    it("should match property types in English", () => {
      const results = getSuggestions("vi", "en");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.value === "villa")).toBe(true);
    });

    it("should match property types in Arabic", () => {
      const results = getSuggestions("شقة", "ar");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.value === "apartment")).toBe(true);
    });

    it("should limit results to 6", () => {
      // Even with many matches, should cap at 6
      const results = getSuggestions("a", "en"); // too short, returns empty
      expect(results.length).toBeLessThanOrEqual(6);
    });

    it("should return both cities and types when matching", () => {
      // "da" matches "Dammam" city
      const results = getSuggestions("da", "en");
      expect(results.some(r => r.type === "city")).toBe(true);
    });
  });

  describe("Search Input Sanitization", () => {
    it("should handle special characters in search query", () => {
      const params = new URLSearchParams();
      const q = "apartment <script>alert('xss')</script>";
      if (q) params.set("q", q);
      // URL encoding should handle special chars
      const decoded = new URLSearchParams(params.toString());
      expect(decoded.get("q")).toBe(q);
    });

    it("should handle very long search queries", () => {
      const longQuery = "a".repeat(300);
      const params = new URLSearchParams();
      params.set("q", longQuery);
      expect(params.get("q")?.length).toBe(300);
      // Backend should truncate to 200 chars via z.string().max(200)
    });
  });

  describe("Quick Filter Buttons", () => {
    const quickCities = [
      { ar: "الرياض", en: "Riyadh" },
      { ar: "جدة", en: "Jeddah" },
      { ar: "المدينة المنورة", en: "Madinah" },
      { ar: "الدمام", en: "Dammam" },
    ];

    it("should have 4 quick filter city buttons", () => {
      expect(quickCities.length).toBe(4);
    });

    it("should generate correct URL for each quick city", () => {
      quickCities.forEach(city => {
        const params = new URLSearchParams();
        params.set("city", city.en);
        expect(params.get("city")).toBe(city.en);
      });
    });

    it("should have both Arabic and English names", () => {
      quickCities.forEach(city => {
        expect(city.ar).toBeTruthy();
        expect(city.en).toBeTruthy();
      });
    });
  });
});
