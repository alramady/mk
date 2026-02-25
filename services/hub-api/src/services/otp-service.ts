/**
 * OTP Service — MonthlyKey Verification
 *
 * Handles OTP generation, hashing, verification, rate limiting,
 * and provider abstraction for SMS/Email delivery.
 *
 * Security:
 * - OTP stored as SHA-256(code + salt), never plaintext
 * - 5-minute TTL
 * - Max 5 verification attempts per code
 * - 60-second cooldown between sends
 * - Provider abstraction: console stubs when keys not configured
 */

import crypto from "crypto";
import { db } from "../db/connection.js";
import { otpCodes, users } from "../db/schema.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { config } from "../config.js";
import type { PreferredLocale } from "@mk/shared";

// ─── Constants ─────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

// ─── Provider Interfaces ───────────────────────────────────
export interface SmsProvider {
  sendOtp(phoneE164: string, code: string, locale: PreferredLocale): Promise<void>;
}

export interface EmailProvider {
  sendOtp(email: string, code: string, locale: PreferredLocale): Promise<void>;
}

// ─── Console Stubs (default when no provider configured) ───
export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phoneE164: string, code: string, locale: PreferredLocale): Promise<void> {
    const masked = phoneE164.slice(0, 4) + "****" + phoneE164.slice(-2);
    // In production, NEVER log the actual OTP code
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      console.log(`[SMS-STUB] OTP sent to ${masked} (locale=${locale}) — code redacted in production`);
    } else {
      console.log(`[SMS-STUB] OTP for ${masked}: ${code} (locale=${locale})`);
    }
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async sendOtp(email: string, code: string, locale: PreferredLocale): Promise<void> {
    const [local, domain] = email.split("@");
    const masked = local.slice(0, 2) + "***@" + domain;
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      console.log(`[EMAIL-STUB] OTP sent to ${masked} (locale=${locale}) — code redacted in production`);
    } else {
      console.log(`[EMAIL-STUB] OTP for ${masked}: ${code} (locale=${locale})`);
    }
  }
}

// ─── Provider Registry ─────────────────────────────────────
let smsProvider: SmsProvider = new ConsoleSmsProvider();
let emailProvider: EmailProvider = new ConsoleEmailProvider();

export function setSmsProvider(provider: SmsProvider) {
  smsProvider = provider;
}

export function setEmailProvider(provider: EmailProvider) {
  emailProvider = provider;
}

export function getSmsProvider(): SmsProvider {
  return smsProvider;
}

export function getEmailProvider(): EmailProvider {
  return emailProvider;
}

// ─── Hashing ───────────────────────────────────────────────
function generateOtp(): string {
  // Cryptographically secure 6-digit OTP
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(OTP_LENGTH, "0");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashOtp(code: string, salt: string): string {
  return crypto.createHash("sha256").update(code + salt).digest("hex");
}

// ─── OTP Send ──────────────────────────────────────────────
export interface OtpSendResult {
  success: boolean;
  error?: string;
  cooldownRemaining?: number; // seconds
}

export async function sendOtp(
  userId: string,
  channel: "phone" | "email",
): Promise<OtpSendResult> {
  // 1. Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // 2. Determine destination
  const destination = channel === "phone" ? user.phoneE164 : user.email;
  if (!destination) {
    return { success: false, error: `No ${channel} on file` };
  }

  // 3. Check cooldown — find most recent OTP for this user+channel
  const recent = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.userId, userId),
      eq(otpCodes.channel, channel),
    ),
    orderBy: [desc(otpCodes.createdAt)],
  });

  if (recent) {
    const elapsed = Date.now() - new Date(recent.createdAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return { success: false, error: "Cooldown active", cooldownRemaining: remaining };
    }
  }

  // 4. Generate + hash OTP
  const code = generateOtp();
  const salt = generateSalt();
  const otpHash = hashOtp(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // 5. Store in DB
  await db.insert(otpCodes).values({
    userId,
    channel,
    destination,
    otpHash,
    salt,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt,
  });

  // 6. Send via provider
  try {
    const locale = user.preferredLocale ?? "ar";
    if (channel === "phone") {
      await smsProvider.sendOtp(destination, code, locale);
    } else {
      await emailProvider.sendOtp(destination, code, locale);
    }
  } catch (err) {
    console.error(`[OTP] Failed to send ${channel} OTP:`, err);
    return { success: false, error: "Failed to send OTP" };
  }

  return { success: true };
}

// ─── OTP Verify ────────────────────────────────────────────
export interface OtpVerifyResult {
  success: boolean;
  error?: string;
}

export async function verifyOtp(
  userId: string,
  channel: "phone" | "email",
  code: string,
): Promise<OtpVerifyResult> {
  // 1. Find the most recent unexpired, unverified OTP for this user+channel
  const otp = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.userId, userId),
      eq(otpCodes.channel, channel),
      gt(otpCodes.expiresAt, new Date()),
    ),
    orderBy: [desc(otpCodes.createdAt)],
  });

  if (!otp) {
    return { success: false, error: "No valid OTP found — request a new one" };
  }

  if (otp.verifiedAt) {
    return { success: false, error: "OTP already used" };
  }

  // 2. Check attempt limit
  if (otp.attempts >= otp.maxAttempts) {
    return { success: false, error: "Too many attempts — request a new code" };
  }

  // 3. Increment attempts
  await db.update(otpCodes)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(otpCodes.id, otp.id));

  // 4. Verify hash
  const expectedHash = hashOtp(code, otp.salt);
  if (expectedHash !== otp.otpHash) {
    return { success: false, error: "Invalid code" };
  }

  // 5. Mark OTP as verified
  const now = new Date();
  await db.update(otpCodes)
    .set({ verifiedAt: now })
    .where(eq(otpCodes.id, otp.id));

  // 6. Update user verification timestamps
  if (channel === "phone") {
    await db.update(users)
      .set({ phoneVerifiedAt: now })
      .where(eq(users.id, userId));
  } else {
    await db.update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, userId));
  }

  // 7. Check if both channels are now verified → update verificationState
  const updatedUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (updatedUser?.phoneVerifiedAt && updatedUser?.emailVerifiedAt) {
    await db.update(users)
      .set({ verificationState: "VERIFIED" })
      .where(eq(users.id, userId));
  }

  return { success: true };
}

// ─── Verification Status ───────────────────────────────────
export async function getVerificationStatus(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  return {
    phone_verified: !!user.phoneVerifiedAt,
    email_verified: !!user.emailVerifiedAt,
    verification_state: user.verificationState,
  };
}
