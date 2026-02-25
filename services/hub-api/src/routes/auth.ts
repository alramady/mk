import { Router } from "express";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import type { AuthPayload } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { sendOtp, verifyOtp, getVerificationStatus } from "../services/otp-service.js";
import type { PreferredLocale, SignupRequest } from "@mk/shared";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────
const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ARABIC_REGEX = /[\u0600-\u06FF]/;

function isValidLocale(v: unknown): v is PreferredLocale {
  return v === "ar" || v === "en";
}

function normalizeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    full_name_ar: user.fullNameAr,
    full_name_en: user.fullNameEn,
    preferred_locale: user.preferredLocale,
    email: user.email,
    phone: user.phone,
    phone_e164: user.phoneE164,
    role: user.role,
    zones: user.zones,
    verification_state: user.verificationState,
    email_verified: !!user.emailVerifiedAt,
    phone_verified: !!user.phoneVerifiedAt,
  };
}

// ─── POST /login ───────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Email and password required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    res.json({ token, user: normalizeUser(user) });
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Login failed" });
  }
});

// ─── POST /register (locale-aware signup) ──────────────────
router.post("/register", async (req, res) => {
  try {
    const body = req.body as Partial<SignupRequest> & { name?: string; password_confirm?: string };

    // 1. Validate locale
    const locale = body.preferred_locale ?? "ar";
    if (!isValidLocale(locale)) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "preferred_locale must be 'ar' or 'en'" });
    }

    // 2. Validate email
    if (!body.email || !EMAIL_REGEX.test(body.email)) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Valid email required" });
    }

    // 3. Validate phone (E.164)
    if (!body.phone_e164 || !E164_REGEX.test(body.phone_e164)) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Valid phone in E.164 format required (e.g. +966501234567)" });
    }

    // 4. Validate password
    if (!body.password || body.password.length < 8) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Password must be at least 8 characters" });
    }

    // 5. Locale-conditional name validation
    if (locale === "ar") {
      if (!body.full_name_ar || body.full_name_ar.trim().length < 2) {
        return res.status(400).json({ code: "BAD_REQUEST", message: "الاسم الكامل بالعربي مطلوب" });
      }
      if (body.full_name_ar && !ARABIC_REGEX.test(body.full_name_ar)) {
        return res.status(400).json({ code: "BAD_REQUEST", message: "الاسم بالعربي يجب أن يحتوي على حروف عربية" });
      }
    } else {
      if (!body.full_name_en || body.full_name_en.trim().length < 2) {
        return res.status(400).json({ code: "BAD_REQUEST", message: "Full name in English is required" });
      }
    }

    // 6. Check for existing email or phone
    const existing = await db.query.users.findFirst({
      where: or(
        eq(users.email, body.email),
        eq(users.phoneE164, body.phone_e164),
      ),
    });
    if (existing) {
      const field = existing.email === body.email ? "Email" : "Phone";
      return res.status(409).json({ code: "CONFLICT", message: `${field} already registered` });
    }

    // 7. Create user
    const passwordHash = await bcrypt.hash(body.password, 10);
    const displayName = locale === "ar"
      ? (body.full_name_ar ?? body.full_name_en ?? "")
      : (body.full_name_en ?? body.full_name_ar ?? "");

    const [user] = await db.insert(users).values({
      name: displayName,
      fullNameAr: body.full_name_ar?.trim() ?? null,
      fullNameEn: body.full_name_en?.trim() ?? null,
      preferredLocale: locale,
      email: body.email.toLowerCase().trim(),
      phone: body.phone_e164, // legacy field
      phoneE164: body.phone_e164,
      passwordHash,
      role: "TENANT",
      verificationState: "PENDING_VERIFICATION",
    }).returning();

    // 8. Issue token
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    res.status(201).json({ token, user: normalizeUser(user) });
  } catch (err) {
    console.error("[AUTH] Registration failed:", err);
    res.status(500).json({ code: "INTERNAL", message: "Registration failed" });
  }
});

// ─── POST /verification/phone/send ─────────────────────────
router.post("/verification/phone/send", requireAuth, async (req, res) => {
  try {
    const result = await sendOtp(req.auth!.userId, "phone");
    if (!result.success) {
      const status = result.cooldownRemaining ? 429 : 400;
      return res.status(status).json({
        code: result.cooldownRemaining ? "COOLDOWN" : "BAD_REQUEST",
        message: result.error,
        cooldown_remaining: result.cooldownRemaining,
      });
    }
    res.json({ success: true, message: "OTP sent to phone" });
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Failed to send phone OTP" });
  }
});

// ─── POST /verification/phone/verify ────────────────────────
router.post("/verification/phone/verify", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string" || code.length !== 6) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "6-digit code required" });
    }
    const result = await verifyOtp(req.auth!.userId, "phone", code);
    if (!result.success) {
      return res.status(400).json({ code: "INVALID_OTP", message: result.error });
    }
    res.json({ success: true, message: "Phone verified" });
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Verification failed" });
  }
});

// ─── POST /verification/email/send ──────────────────────────
router.post("/verification/email/send", requireAuth, async (req, res) => {
  try {
    const result = await sendOtp(req.auth!.userId, "email");
    if (!result.success) {
      const status = result.cooldownRemaining ? 429 : 400;
      return res.status(status).json({
        code: result.cooldownRemaining ? "COOLDOWN" : "BAD_REQUEST",
        message: result.error,
        cooldown_remaining: result.cooldownRemaining,
      });
    }
    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Failed to send email OTP" });
  }
});

// ─── POST /verification/email/verify ────────────────────────
router.post("/verification/email/verify", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string" || code.length !== 6) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "6-digit code required" });
    }
    const result = await verifyOtp(req.auth!.userId, "email", code);
    if (!result.success) {
      return res.status(400).json({ code: "INVALID_OTP", message: result.error });
    }
    res.json({ success: true, message: "Email verified" });
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Verification failed" });
  }
});

// ─── GET /verification/status ───────────────────────────────
router.get("/verification/status", requireAuth, async (req, res) => {
  try {
    const status = await getVerificationStatus(req.auth!.userId);
    if (!status) {
      return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ code: "INTERNAL", message: "Failed to get verification status" });
  }
});

export default router;
