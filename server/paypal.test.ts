import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAllSettings: vi.fn().mockResolvedValue({
    "payment.paypalClientId": "test-client-id",
    "payment.paypalSecret": "test-secret",
    "payment.paypalMode": "sandbox",
    "payment.currency": "SAR",
    "payment.enabled": "true",
    "payment.cashEnabled": "true",
  }),
  updateBookingPayment: vi.fn().mockResolvedValue(undefined),
  getBookingById: vi.fn().mockResolvedValue({ id: 1, tenantId: 1, landlordId: 2, totalAmount: "5000" }),
}));

describe("PayPal Payment Module", () => {
  it("should export getPayPalSettings function", async () => {
    const { getPayPalSettings } = await import("./paypal");
    expect(getPayPalSettings).toBeDefined();
    expect(typeof getPayPalSettings).toBe("function");
  });

  it("should return correct settings from database", async () => {
    const { getPayPalSettings } = await import("./paypal");
    const settings = await getPayPalSettings();
    expect(settings.clientId).toBe("test-client-id");
    expect(settings.secret).toBe("test-secret");
    expect(settings.mode).toBe("sandbox");
    expect(settings.currency).toBe("SAR");
    expect(settings.enabled).toBe(true);
    expect(settings.cashEnabled).toBe(true);
  });

  it("should handle missing credentials gracefully", async () => {
    const db = await import("./db");
    (db.getAllSettings as any).mockResolvedValueOnce({
      "payment.paypalClientId": "",
      "payment.paypalSecret": "",
      "payment.paypalMode": "sandbox",
      "payment.currency": "SAR",
      "payment.enabled": "false",
      "payment.cashEnabled": "true",
    });
    const { getPayPalSettings } = await import("./paypal");
    const settings = await getPayPalSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.clientId).toBe("");
  });

  it("should export createPayPalOrder function", async () => {
    const { createPayPalOrder } = await import("./paypal");
    expect(createPayPalOrder).toBeDefined();
    expect(typeof createPayPalOrder).toBe("function");
  });

  it("should export capturePayPalOrder function", async () => {
    const { capturePayPalOrder } = await import("./paypal");
    expect(capturePayPalOrder).toBeDefined();
    expect(typeof capturePayPalOrder).toBe("function");
  });

  it("should handle disabled payment correctly", async () => {
    const db = await import("./db");
    (db.getAllSettings as any).mockResolvedValueOnce({
      "payment.enabled": "false",
      "payment.cashEnabled": "true",
    });
    const { getPayPalSettings } = await import("./paypal");
    const settings = await getPayPalSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.cashEnabled).toBe(true);
  });

  it("should handle live mode setting", async () => {
    const db = await import("./db");
    (db.getAllSettings as any).mockResolvedValueOnce({
      "payment.paypalClientId": "live-id",
      "payment.paypalSecret": "live-secret",
      "payment.paypalMode": "live",
      "payment.currency": "SAR",
      "payment.enabled": "true",
      "payment.cashEnabled": "false",
    });
    const { getPayPalSettings } = await import("./paypal");
    const settings = await getPayPalSettings();
    expect(settings.mode).toBe("live");
    expect(settings.cashEnabled).toBe(false);
  });
});
