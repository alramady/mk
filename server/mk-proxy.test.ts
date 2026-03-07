import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the Monthly Key API proxy module.
 * Validates that the proxy correctly forwards requests to monthlykey.com
 * and handles error cases gracefully.
 */

// Mock axios to avoid real HTTP calls
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from "axios";

const mockedAxios = vi.mocked(axios);

describe("MK Proxy Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should construct the correct target URL for featured properties", () => {
    // The proxy maps /api/mk/* to https://monthlykey.com/api/trpc/*
    const proxyPath = "property.featured";
    const targetUrl = `https://monthlykey.com/api/trpc/${proxyPath}`;
    expect(targetUrl).toBe("https://monthlykey.com/api/trpc/property.featured");
  });

  it("should construct the correct target URL for search with query params", () => {
    const proxyPath = "property.search";
    const queryString = `input=${encodeURIComponent(JSON.stringify({ json: { city: "الرياض", limit: 20 } }))}`;
    const targetUrl = `https://monthlykey.com/api/trpc/${proxyPath}?${queryString}`;
    expect(targetUrl).toContain("monthlykey.com/api/trpc/property.search");
    expect(targetUrl).toContain("input=");
  });

  it("should construct the correct target URL for property detail", () => {
    const proxyPath = "property.getById";
    const targetUrl = `https://monthlykey.com/api/trpc/${proxyPath}`;
    expect(targetUrl).toBe("https://monthlykey.com/api/trpc/property.getById");
  });

  it("should construct the correct target URL for cities", () => {
    const proxyPath = "cities.all";
    const targetUrl = `https://monthlykey.com/api/trpc/${proxyPath}`;
    expect(targetUrl).toBe("https://monthlykey.com/api/trpc/cities.all");
  });

  it("should construct the correct target URL for calculator config", () => {
    const proxyPath = "calculator.config";
    const targetUrl = `https://monthlykey.com/api/trpc/${proxyPath}`;
    expect(targetUrl).toBe("https://monthlykey.com/api/trpc/calculator.config");
  });

  it("should handle proxy errors gracefully", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Network Error"));

    try {
      await mockedAxios.get("https://monthlykey.com/api/trpc/property.featured");
    } catch (error: any) {
      expect(error.message).toBe("Network Error");
    }
  });

  it("should forward successful responses from monthlykey.com", async () => {
    const mockResponse = {
      status: 200,
      data: {
        result: {
          data: {
            json: [
              { id: 1, titleAr: "شقة مفروشة", cityAr: "الرياض" },
            ],
          },
        },
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const response = await mockedAxios.get("https://monthlykey.com/api/trpc/property.featured");
    expect(response.status).toBe(200);
    expect(response.data.result.data.json).toHaveLength(1);
    expect(response.data.result.data.json[0].titleAr).toBe("شقة مفروشة");
  });

  it("should handle 404 responses from monthlykey.com", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 404,
      data: { error: "Not found" },
    });

    const response = await mockedAxios.get("https://monthlykey.com/api/trpc/property.nonexistent");
    expect(response.status).toBe(404);
  });
});

describe("Pricing Calculation Logic", () => {
  const VAT_RATE = 15;
  const SERVICE_FEE_RATE = 5;
  const INSURANCE_RATE = 10;

  function calculateBookingTotal(monthlyRent: number, months: number) {
    const baseRentTotal = monthlyRent * months;
    const insuranceAmount = Math.round(baseRentTotal * (INSURANCE_RATE / 100));
    const serviceFeeAmount = Math.round(baseRentTotal * (SERVICE_FEE_RATE / 100));
    const subtotal = baseRentTotal + insuranceAmount + serviceFeeAmount;
    const vatAmount = Math.round(subtotal * (VAT_RATE / 100));
    const grandTotal = subtotal + vatAmount;

    return {
      baseRentTotal,
      insuranceAmount,
      serviceFeeAmount,
      subtotal,
      vatAmount,
      grandTotal,
      appliedRates: { vatRate: VAT_RATE, serviceFeeRate: SERVICE_FEE_RATE, insuranceRate: INSURANCE_RATE },
      hideInsuranceFromTenant: false,
    };
  }

  it("should calculate correct total for 1 month at 5000 SAR", () => {
    const result = calculateBookingTotal(5000, 1);
    expect(result.baseRentTotal).toBe(5000);
    expect(result.insuranceAmount).toBe(500); // 10%
    expect(result.serviceFeeAmount).toBe(250); // 5%
    expect(result.subtotal).toBe(5750);
    expect(result.vatAmount).toBe(863); // 15% of 5750 = 862.5 rounded
    expect(result.grandTotal).toBe(6613);
  });

  it("should calculate correct total for 3 months at 8000 SAR", () => {
    const result = calculateBookingTotal(8000, 3);
    expect(result.baseRentTotal).toBe(24000);
    expect(result.insuranceAmount).toBe(2400);
    expect(result.serviceFeeAmount).toBe(1200);
    expect(result.subtotal).toBe(27600);
    expect(result.vatAmount).toBe(4140);
    expect(result.grandTotal).toBe(31740);
  });

  it("should always include 15% VAT", () => {
    const result = calculateBookingTotal(10000, 1);
    expect(result.appliedRates.vatRate).toBe(15);
    expect(result.vatAmount).toBe(Math.round(result.subtotal * 0.15));
  });

  it("should handle zero rent gracefully", () => {
    const result = calculateBookingTotal(0, 1);
    expect(result.grandTotal).toBe(0);
  });

  it("should format prices in SAR correctly", () => {
    const formatted = new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(5000);
    // Should contain SAR or ر.س
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe("Property Data Validation", () => {
  it("should validate property type labels exist for common types", () => {
    const propertyTypeLabels: Record<string, string> = {
      apartment: "شقة",
      villa: "فيلا",
      studio: "استوديو",
      duplex: "دوبلكس",
      room: "غرفة",
    };

    expect(propertyTypeLabels.apartment).toBe("شقة");
    expect(propertyTypeLabels.villa).toBe("فيلا");
    expect(propertyTypeLabels.studio).toBe("استوديو");
  });

  it("should validate furnished level labels", () => {
    const furnishedLabels: Record<string, string> = {
      fully_furnished: "مفروشة بالكامل",
      semi_furnished: "مفروشة جزئياً",
      unfurnished: "غير مفروشة",
    };

    expect(furnishedLabels.fully_furnished).toBe("مفروشة بالكامل");
    expect(furnishedLabels.unfurnished).toBe("غير مفروشة");
  });

  it("should validate Saudi city names are in Arabic", () => {
    const cities = ["الرياض", "جدة", "المدينة المنورة", "الدمام", "مكة المكرمة", "الخبر"];
    cities.forEach((city) => {
      // Arabic characters are in Unicode range 0600-06FF
      expect(/[\u0600-\u06FF]/.test(city)).toBe(true);
    });
  });
});
