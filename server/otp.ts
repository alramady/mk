/**
 * OTP Service
 *
 * Handles OTP generation, hashing, storage, sending, and verification.
 * Uses bcrypt for hashing (same as passwords) with a pepper for extra security.
 * Rate limiting is per-destination + per-IP.
 *
 * Standard Node/TypeScript only. No external AI dependencies.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { otpCodes } from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { rateLimiter, getClientIP } from "./rate-limiter";
import { getSmsProvider, getEmailOtpProvider } from "./otp-providers";

// ─── Constants ───────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_DESTINATION = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ─── Rate Limit Presets for OTP ──────────────────────────────────────
export const OTP_RATE_LIMITS = {
  SEND_PER_DEST: { maxRequests: MAX_SENDS_PER_DESTINATION, windowMs: SEND_WINDOW_MS },
  SEND_PER_IP: { maxRequests: 10, windowMs: SEND_WINDOW_MS },
  VERIFY_PER_IP: { maxRequests: 20, windowMs: 5 * 60 * 1000 },
} as const;

// ─── Generate OTP ────────────────────────────────────────────────────
function generateOtpCode(): string {
  // Cryptographically secure random 6-digit code
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(OTP_LENGTH, "0");
}

// ─── Hash OTP (with pepper) ──────────────────────────────────────────
async function hashOtp(code: string): Promise<string> {
  const peppered = code + ENV.otpSecretPepper;
  return bcrypt.hash(peppered, 10);
}

async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  const peppered = code + ENV.otpSecretPepper;
  return bcrypt.compare(peppered, hash);
}

// ─── Send OTP ────────────────────────────────────────────────────────
export async function sendOtp(params: {
  channel: "phone" | "email";
  destination: string;
  purpose: string;
  userId?: number;
  ip: string;
  lang?: "ar" | "en";
}): Promise<{ success: boolean; error?: string; errorAr?: string; retryAfterMs?: number; devCode?: string }> {
  const { channel, destination, purpose, userId, ip, lang = "ar" } = params;

  // Rate limit per destination
  const destRl = rateLimiter.check(
    `otp:send:${destination}`,
    OTP_RATE_LIMITS.SEND_PER_DEST.maxRequests,
    OTP_RATE_LIMITS.SEND_PER_DEST.windowMs
  );
  if (!destRl.allowed) {
    return {
      success: false,
      error: "Too many OTP requests for this destination. Please wait.",
      errorAr: "طلبات كثيرة لهذا الرقم/الإيميل. يرجى الانتظار.",
      retryAfterMs: destRl.resetIn,
    };
  }

  // Rate limit per IP
  const ipRl = rateLimiter.check(
    `otp:send:ip:${ip}`,
    OTP_RATE_LIMITS.SEND_PER_IP.maxRequests,
    OTP_RATE_LIMITS.SEND_PER_IP.windowMs
  );
  if (!ipRl.allowed) {
    return {
      success: false,
      error: "Too many OTP requests. Please wait.",
      errorAr: "طلبات كثيرة. يرجى الانتظار.",
      retryAfterMs: ipRl.resetIn,
    };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database unavailable", errorAr: "قاعدة البيانات غير متاحة" };
  }

  // Generate and hash OTP
  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  const ttlMs = ENV.otpTtlSeconds * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  // Store OTP
  await db.insert(otpCodes).values({
    userId: userId ?? null,
    channel,
    destination,
    codeHash,
    purpose,
    expiresAt,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
  });

  // Send via provider
  try {
    if (channel === "phone") {
      const smsProvider = getSmsProvider();
      const message = lang === "ar"
        ? `رمز التحقق الخاص بك في المفتاح الشهري: ${code}\nصالح لمدة 5 دقائق.`
        : `Your Monthly Key verification code: ${code}\nValid for 5 minutes.`;
      const result = await smsProvider.send(destination, message);
      if (!result.success) {
        return { success: false, error: result.error || "SMS send failed", errorAr: "فشل إرسال الرسالة النصية" };
      }
    } else {
      const emailProvider = getEmailOtpProvider();
      const subject = lang === "ar" ? "رمز التحقق - المفتاح الشهري" : "Verification Code - Monthly Key";
      const html = `
        <div dir="${lang === "ar" ? "rtl" : "ltr"}" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0B1E2D; text-align: center;">
            ${lang === "ar" ? "رمز التحقق" : "Verification Code"}
          </h2>
          <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0B1E2D;">${code}</span>
          </div>
          <p style="color: #666; text-align: center; font-size: 14px;">
            ${lang === "ar" ? "صالح لمدة 5 دقائق" : "Valid for 5 minutes"}
          </p>
          <p style="color: #999; text-align: center; font-size: 12px;">
            ${lang === "ar" ? "إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة." : "If you didn't request this code, ignore this message."}
          </p>
        </div>
      `;
      const result = await emailProvider.send(destination, subject, html);
      if (!result.success) {
        return { success: false, error: result.error || "Email send failed", errorAr: "فشل إرسال البريد الإلكتروني" };
      }
    }
  } catch (err) {
    console.error(`[OTP] Failed to send via ${channel}:`, err);
    return { success: false, error: "Failed to send OTP", errorAr: "فشل إرسال رمز التحقق" };
  }

  console.log(`[OTP] Sent ${channel} OTP to ${destination} for purpose=${purpose}`);

  // In dev mode, return the code for testing (NEVER in production)
  const devCode = !ENV.isProduction ? code : undefined;

  return { success: true, devCode };
}

// ─── Verify OTP ──────────────────────────────────────────────────────
export async function verifyOtp(params: {
  channel: "phone" | "email";
  destination: string;
  code: string;
  purpose: string;
  ip: string;
}): Promise<{ success: boolean; error?: string; errorAr?: string }> {
  const { channel, destination, code, purpose, ip } = params;

  // Rate limit verification attempts per IP
  const ipRl = rateLimiter.check(
    `otp:verify:ip:${ip}`,
    OTP_RATE_LIMITS.VERIFY_PER_IP.maxRequests,
    OTP_RATE_LIMITS.VERIFY_PER_IP.windowMs
  );
  if (!ipRl.allowed) {
    return {
      success: false,
      error: "Too many verification attempts. Please wait.",
      errorAr: "محاولات تحقق كثيرة. يرجى الانتظار.",
    };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database unavailable", errorAr: "قاعدة البيانات غير متاحة" };
  }

  // Find the latest non-consumed, non-expired OTP for this destination + purpose
  const now = new Date();
  const results = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.channel, channel),
        eq(otpCodes.destination, destination),
        eq(otpCodes.purpose, purpose),
        gte(otpCodes.expiresAt, now)
      )
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (results.length === 0) {
    return {
      success: false,
      error: "No valid OTP found. Please request a new one.",
      errorAr: "لا يوجد رمز صالح. يرجى طلب رمز جديد.",
    };
  }

  const otp = results[0];

  // Already consumed
  if (otp.consumedAt) {
    return {
      success: false,
      error: "This OTP has already been used.",
      errorAr: "تم استخدام هذا الرمز مسبقاً.",
    };
  }

  // Max attempts exceeded
  if (otp.attempts >= otp.maxAttempts) {
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
      errorAr: "تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد.",
    };
  }

  // Increment attempts
  await db
    .update(otpCodes)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(otpCodes.id, otp.id));

  // Verify hash
  const isValid = await verifyOtpHash(code, otp.codeHash);
  if (!isValid) {
    const remaining = otp.maxAttempts - (otp.attempts + 1);
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt(s) remaining.`,
      errorAr: `رمز غير صحيح. متبقي ${remaining} محاولة.`,
    };
  }

  // Mark as consumed
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(otpCodes.id, otp.id));

  console.log(`[OTP] Verified ${channel} OTP for ${destination} purpose=${purpose}`);

  return { success: true };
}
