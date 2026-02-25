/**
 * ═══════════════════════════════════════════════════════════════
 *  Auth / Signup / OTP — Automated Tests
 * ═══════════════════════════════════════════════════════════════
 *
 *  Tests the signup validation, locale-conditional name rules,
 *  OTP schema validation, and login schema validation.
 *
 *  Pure unit tests — no database or HTTP server required.
 *  They test the Zod schemas and validation logic only.
 *
 *  Run: npx vitest run tests/auth-signup-otp.test.ts
 * ═══════════════════════════════════════════════════════════════
 */
import { describe, it, expect } from "vitest";
import {
  signupSchema,
  otpVerifySchema,
  loginSchema,
  preferredLocaleSchema,
} from "@mk/shared";

// ─── Signup Schema ────────────────────────────────────────────

describe("signupSchema", () => {
  const validAr = {
    preferred_locale: "ar" as const,
    full_name_ar: "محمد أحمد",
    email: "test@example.com",
    phone_e164: "+966501234567",
    password: "securepass123",
  };

  const validEn = {
    preferred_locale: "en" as const,
    full_name_en: "Mohammed Ahmed",
    email: "test@example.com",
    phone_e164: "+966501234567",
    password: "securepass123",
  };

  // ── Happy paths ──────────────────────────────────────────

  it("accepts valid Arabic signup", () => {
    const result = signupSchema.safeParse(validAr);
    expect(result.success).toBe(true);
  });

  it("accepts valid English signup", () => {
    const result = signupSchema.safeParse(validEn);
    expect(result.success).toBe(true);
  });

  it("accepts Arabic signup with optional English name", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      full_name_en: "Mohammed Ahmed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts English signup with optional Arabic name", () => {
    const result = signupSchema.safeParse({
      ...validEn,
      full_name_ar: "محمد أحمد",
    });
    expect(result.success).toBe(true);
  });

  // ── Locale validation ────────────────────────────────────

  it("rejects locale=ar when full_name_ar is missing", () => {
    const result = signupSchema.safeParse({
      preferred_locale: "ar",
      email: "test@example.com",
      phone_e164: "+966501234567",
      password: "securepass123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const arNameError = result.error.issues.find(
        (i) => i.path.includes("full_name_ar"),
      );
      expect(arNameError).toBeDefined();
    }
  });

  it("rejects locale=en when full_name_en is missing", () => {
    const result = signupSchema.safeParse({
      preferred_locale: "en",
      email: "test@example.com",
      phone_e164: "+966501234567",
      password: "securepass123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const enNameError = result.error.issues.find(
        (i) => i.path.includes("full_name_en"),
      );
      expect(enNameError).toBeDefined();
    }
  });

  it("rejects locale=ar when full_name_ar has no Arabic characters", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      full_name_ar: "Mohammed Ahmed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const arNameError = result.error.issues.find(
        (i) => i.path.includes("full_name_ar"),
      );
      expect(arNameError).toBeDefined();
    }
  });

  it("rejects locale=ar when full_name_ar is too short", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      full_name_ar: "م",
    });
    expect(result.success).toBe(false);
  });

  it("rejects locale=en when full_name_en is too short", () => {
    const result = signupSchema.safeParse({
      ...validEn,
      full_name_en: "M",
    });
    expect(result.success).toBe(false);
  });

  // ── Email validation ─────────────────────────────────────

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      email: "",
    });
    expect(result.success).toBe(false);
  });

  // ── Phone validation (E.164) ─────────────────────────────

  it("rejects phone without + prefix", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      phone_e164: "966501234567",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone with letters", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      phone_e164: "+966abc1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone starting with +0", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      phone_e164: "+0501234567",
    });
    expect(result.success).toBe(false);
  });

  it("accepts various valid E.164 formats", () => {
    const phones = ["+966501234567", "+971501234567", "+12025551234", "+442071234567"];
    for (const phone of phones) {
      const result = signupSchema.safeParse({ ...validAr, phone_e164: phone });
      expect(result.success).toBe(true);
    }
  });

  // ── Password validation ──────────────────────────────────

  it("rejects password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      password: "",
    });
    expect(result.success).toBe(false);
  });

  // ── Locale enum ──────────────────────────────────────────

  it("rejects invalid locale", () => {
    const result = signupSchema.safeParse({
      ...validAr,
      preferred_locale: "fr",
    });
    expect(result.success).toBe(false);
  });
});

// ─── OTP Verify Schema ───────────────────────────────────────

describe("otpVerifySchema", () => {
  it("accepts valid 6-digit code", () => {
    expect(otpVerifySchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("accepts code with leading zeros", () => {
    expect(otpVerifySchema.safeParse({ code: "000001" }).success).toBe(true);
  });

  it("rejects code shorter than 6 digits", () => {
    expect(otpVerifySchema.safeParse({ code: "12345" }).success).toBe(false);
  });

  it("rejects code longer than 6 digits", () => {
    expect(otpVerifySchema.safeParse({ code: "1234567" }).success).toBe(false);
  });

  it("rejects code with letters", () => {
    expect(otpVerifySchema.safeParse({ code: "12345a" }).success).toBe(false);
  });

  it("rejects empty code", () => {
    expect(otpVerifySchema.safeParse({ code: "" }).success).toBe(false);
  });
});

// ─── Login Schema ─────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid login", () => {
    expect(
      loginSchema.safeParse({ email: "test@example.com", password: "pass123" }).success,
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(
      loginSchema.safeParse({ email: "not-email", password: "pass123" }).success,
    ).toBe(false);
  });

  it("rejects empty password", () => {
    expect(
      loginSchema.safeParse({ email: "test@example.com", password: "" }).success,
    ).toBe(false);
  });
});

// ─── Preferred Locale Schema ──────────────────────────────────

describe("preferredLocaleSchema", () => {
  it("accepts 'ar'", () => {
    expect(preferredLocaleSchema.safeParse("ar").success).toBe(true);
  });

  it("accepts 'en'", () => {
    expect(preferredLocaleSchema.safeParse("en").success).toBe(true);
  });

  it("rejects 'fr'", () => {
    expect(preferredLocaleSchema.safeParse("fr").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(preferredLocaleSchema.safeParse("").success).toBe(false);
  });
});
