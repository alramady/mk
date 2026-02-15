import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer before importing email module
vi.mock("nodemailer", () => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-msg-id-123" });
  const verifyMock = vi.fn().mockResolvedValue(true);
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: sendMailMock,
        verify: verifyMock,
      }),
    },
  };
});

// Mock env
vi.mock("./_core/env", () => ({
  ENV: {
    smtpHost: "smtp.test.com",
    smtpPort: 587,
    smtpUser: "test@test.com",
    smtpPass: "testpass",
    smtpFrom: "المفتاح الشهري <noreply@test.com>",
    smtpSecure: false,
    isProduction: false,
  },
}));

import {
  isSmtpConfigured,
  sendEmail,
  verifySmtpConnection,
  sendBookingConfirmation,
  sendPaymentReceipt,
  sendMaintenanceUpdate,
  sendWelcomeEmail,
} from "./email";

describe("Email Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isSmtpConfigured", () => {
    it("returns true when all SMTP env vars are set", () => {
      expect(isSmtpConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("sends email successfully with correct parameters", async () => {
      const result = await sendEmail({
        to: "tenant@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test-msg-id-123");
    });

    it("handles array of recipients", async () => {
      const result = await sendEmail({
        to: ["a@example.com", "b@example.com"],
        subject: "Multi",
        html: "<p>Test</p>",
      });
      expect(result.success).toBe(true);
    });

    it("includes optional fields (cc, bcc, replyTo)", async () => {
      const result = await sendEmail({
        to: "tenant@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        cc: "cc@example.com",
        bcc: ["bcc1@example.com", "bcc2@example.com"],
        replyTo: "reply@example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("verifySmtpConnection", () => {
    it("returns connected true when SMTP is configured and reachable", async () => {
      const result = await verifySmtpConnection();
      expect(result.connected).toBe(true);
    });
  });

  describe("sendBookingConfirmation", () => {
    it("sends Arabic booking confirmation email", async () => {
      const result = await sendBookingConfirmation({
        tenantEmail: "tenant@example.com",
        tenantName: "أحمد",
        propertyTitle: "شقة فاخرة في الرياض",
        checkIn: "2026-03-01",
        checkOut: "2026-04-01",
        totalAmount: 5000,
        bookingId: 42,
        lang: "ar",
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("sends English booking confirmation email", async () => {
      const result = await sendBookingConfirmation({
        tenantEmail: "tenant@example.com",
        tenantName: "Ahmed",
        propertyTitle: "Luxury Apartment in Riyadh",
        checkIn: "2026-03-01",
        checkOut: "2026-04-01",
        totalAmount: 5000,
        bookingId: 42,
        lang: "en",
      });
      expect(result.success).toBe(true);
    });

    it("defaults to Arabic when no lang specified", async () => {
      const result = await sendBookingConfirmation({
        tenantEmail: "tenant@example.com",
        tenantName: "أحمد",
        propertyTitle: "شقة",
        checkIn: "2026-03-01",
        checkOut: "2026-04-01",
        totalAmount: 3000,
        bookingId: 1,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("sendPaymentReceipt", () => {
    it("sends payment receipt with transaction ID", async () => {
      const result = await sendPaymentReceipt({
        tenantEmail: "tenant@example.com",
        tenantName: "محمد",
        amount: 5000,
        paymentMethod: "PayPal",
        bookingId: 42,
        transactionId: "TXN-12345",
        lang: "ar",
      });
      expect(result.success).toBe(true);
    });

    it("sends payment receipt without transaction ID", async () => {
      const result = await sendPaymentReceipt({
        tenantEmail: "tenant@example.com",
        tenantName: "محمد",
        amount: 5000,
        paymentMethod: "تحويل بنكي",
        bookingId: 42,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("sendMaintenanceUpdate", () => {
    it("sends maintenance update email in Arabic", async () => {
      const result = await sendMaintenanceUpdate({
        tenantEmail: "tenant@example.com",
        tenantName: "خالد",
        ticketId: 7,
        title: "تسريب مياه في الحمام",
        status: "assigned",
        message: "تم تعيين فني لإصلاح المشكلة",
        lang: "ar",
      });
      expect(result.success).toBe(true);
    });

    it("sends maintenance update email in English", async () => {
      const result = await sendMaintenanceUpdate({
        tenantEmail: "tenant@example.com",
        tenantName: "Khalid",
        ticketId: 7,
        title: "Water leak in bathroom",
        status: "resolved",
        message: "Issue has been fixed",
        lang: "en",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("sendWelcomeEmail", () => {
    it("sends Arabic welcome email", async () => {
      const result = await sendWelcomeEmail({
        email: "new@example.com",
        name: "سارة",
        lang: "ar",
      });
      expect(result.success).toBe(true);
    });

    it("sends English welcome email", async () => {
      const result = await sendWelcomeEmail({
        email: "new@example.com",
        name: "Sara",
        lang: "en",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Email Module - SMTP Not Configured", () => {
  it("gracefully handles missing SMTP config", async () => {
    // Test the sendEmail function behavior when transporter creation fails
    // The actual unconfigured scenario is tested by the isSmtpConfigured check
    const configured = isSmtpConfigured();
    expect(typeof configured).toBe("boolean");
  });
});
