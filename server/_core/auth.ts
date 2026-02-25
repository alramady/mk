/**
 * Local Authentication Routes
 *
 * All authentication is handled via userId + password.
 * No external OAuth provider is used.
 * Rate limiting is applied to login and register endpoints.
 * Authentication events are logged for auditing.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { rateLimiter, RATE_LIMITS, getClientIP } from "../rate-limiter";
import { sendOtp, verifyOtp } from "../otp";
import { ENV } from "./env";

// ─── Auth Event Logger ────────────────────────────────────────────
function logAuthEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[Auth Event] ${timestamp} | ${event} |`, JSON.stringify(details));
}

export function registerAuthRoutes(app: Express) {
  // ─── Local Login ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // Rate limiting: 10 attempts per 5 minutes per IP
    const rl = rateLimiter.check(`auth:login:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs);
    if (!rl.allowed) {
      logAuthEvent("LOGIN_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many login attempts. Please try again later.",
        errorAr: "محاولات دخول كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        res.status(400).json({
          error: "userId and password are required",
          errorAr: "معرف المستخدم وكلمة المرور مطلوبان",
        });
        return;
      }

      const user = await db.getUserByUserId(userId);
      if (!user || !user.passwordHash) {
        logAuthEvent("LOGIN_FAILED", { userId, ip, reason: "user_not_found" });
        res.status(401).json({
          error: "Invalid credentials",
          errorAr: "بيانات الدخول غير صحيحة",
        });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        logAuthEvent("LOGIN_FAILED", { userId, ip, reason: "wrong_password" });
        res.status(401).json({
          error: "Invalid credentials",
          errorAr: "بيانات الدخول غير صحيحة",
        });
        return;
      }

      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      // Create JWT session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.displayName || user.name || userId,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      logAuthEvent("LOGIN_SUCCESS", { userId, userDbId: user.id, ip, role: user.role });

      res.json({
        success: true,
        user: {
          id: user.id,
          userId: user.userId,
          displayName: user.displayName,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      console.error("[Auth] Login error stack:", (error as any)?.stack);
      console.error("[Auth] Login error cause:", (error as any)?.cause);
      logAuthEvent("LOGIN_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Login failed",
        errorAr: "فشل تسجيل الدخول",
      });
    }
  });

  // ─── Local Register ──────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // Rate limiting: 10 attempts per 5 minutes per IP
    const rl = rateLimiter.check(`auth:register:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs);
    if (!rl.allowed) {
      logAuthEvent("REGISTER_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many registration attempts. Please try again later.",
        errorAr: "محاولات تسجيل كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password, displayName, name, nameAr, email, phone } = req.body;

      if (!userId || !password || !displayName) {
        res.status(400).json({
          error: "userId, password, and displayName are required",
          errorAr: "معرف المستخدم وكلمة المرور واسم العرض مطلوبان",
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: "Password must be at least 6 characters",
          errorAr: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        });
        return;
      }

      // Check if userId already exists
      const existing = await db.getUserByUserId(userId);
      if (existing) {
        res.status(409).json({
          error: "User ID already exists",
          errorAr: "معرف المستخدم موجود مسبقاً",
        });
        return;
      }

      // Hash password with bcrypt (cost factor 12)
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const newUserId = await db.createLocalUser({
        userId,
        passwordHash,
        displayName,
        name: name || displayName,
        nameAr,
        email,
        phone,
        role: "user",
      });

      if (!newUserId) {
        res.status(500).json({
          error: "Failed to create user",
          errorAr: "فشل إنشاء الحساب",
        });
        return;
      }

      // Auto-login after register
      const openId = `local_${userId}`;
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      logAuthEvent("REGISTER_SUCCESS", { userId, newUserId, ip });

      res.json({
        success: true,
        user: {
          id: newUserId,
          userId,
          displayName,
          name: name || displayName,
          email,
          role: "user",
        },
      });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      logAuthEvent("REGISTER_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Registration failed",
        errorAr: "فشل التسجيل",
      });
    }
  });

  // ─── Change Password ─────────────────────────────────────────────
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    try {
      const cookies = req.headers.cookie;
      if (!cookies) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { parse } = await import("cookie");
      const parsed = parse(cookies);
      const session = await sdk.verifySession(parsed[COOKIE_NAME]);
      if (!session) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current and new passwords required" });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: "New password must be at least 6 characters" });
        return;
      }

      if (user.passwordHash) {
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          logAuthEvent("PASSWORD_CHANGE_FAILED", { userId: user.userId, ip, reason: "wrong_current_password" });
          res.status(401).json({
            error: "Current password is incorrect",
            errorAr: "كلمة المرور الحالية غير صحيحة",
          });
          return;
        }
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      await db.updateUserPassword(user.id, passwordHash);

      logAuthEvent("PASSWORD_CHANGE_SUCCESS", { userId: user.userId, userDbId: user.id, ip });

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Change password failed:", error);
      logAuthEvent("PASSWORD_CHANGE_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ─── OTP Send ────────────────────────────────────────────────────
  app.post("/api/v1/auth/otp/send", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      const { channel, destination, purpose, lang } = req.body;

      if (!channel || !destination || !purpose) {
        res.status(400).json({
          error: "channel, destination, and purpose are required",
          errorAr: "القناة والوجهة والغرض مطلوبة",
        });
        return;
      }

      if (channel !== "phone" && channel !== "email") {
        res.status(400).json({ error: "channel must be phone or email", errorAr: "القناة يجب أن تكون هاتف أو إيميل" });
        return;
      }

      // Basic validation
      if (channel === "phone") {
        // Must be E.164 format
        if (!/^\+[1-9]\d{6,14}$/.test(destination)) {
          res.status(400).json({
            error: "Phone must be in E.164 format (e.g., +966501234567)",
            errorAr: "رقم الهاتف يجب أن يكون بصيغة دولية (مثال: +966501234567)",
          });
          return;
        }
      } else {
        // Basic email check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
          res.status(400).json({ error: "Invalid email address", errorAr: "بريد إلكتروني غير صالح" });
          return;
        }
      }

      const result = await sendOtp({
        channel,
        destination,
        purpose,
        ip,
        lang: lang || "ar",
      });

      if (!result.success) {
        res.status(429).json(result);
        return;
      }

      const response: Record<string, unknown> = { success: true };
      // In dev mode, return the code for testing
      if (result.devCode) {
        response.devCode = result.devCode;
      }

      logAuthEvent("OTP_SENT", { channel, destination, purpose, ip });
      res.json(response);
    } catch (error) {
      console.error("[Auth] OTP send failed:", error);
      logAuthEvent("OTP_SEND_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to send OTP", errorAr: "فشل إرسال رمز التحقق" });
    }
  });

  // ─── OTP Verify ──────────────────────────────────────────────────
  app.post("/api/v1/auth/otp/verify", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      const { channel, destination, code, purpose } = req.body;

      if (!channel || !destination || !code || !purpose) {
        res.status(400).json({
          error: "channel, destination, code, and purpose are required",
          errorAr: "القناة والوجهة والرمز والغرض مطلوبة",
        });
        return;
      }

      const result = await verifyOtp({ channel, destination, code, purpose, ip });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      // If purpose is registration, update user verification status
      if (purpose === "registration") {
        const user = channel === "phone"
          ? await db.getUserByPhone(destination)
          : await db.getUserByEmail(destination);

        if (user) {
          // Mark user as verified after OTP confirmation
          await db.updateUserProfile(user.id, { isVerified: true } as any);

          // Auto-login after verification
          const updatedUser = await db.getUserById(user.id);
          if (updatedUser) {
            const openId = updatedUser.openId;
            const sessionToken = await sdk.createSessionToken(openId, {
              name: updatedUser.displayName || updatedUser.name || updatedUser.userId || "User",
              expiresInMs: ONE_YEAR_MS,
            });
            const cookieOptions = getSessionCookieOptions(req);
            res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            logAuthEvent("OTP_VERIFY_FULL", { channel, destination, purpose, userId: user.id, ip });
            res.json({
              success: true,
              fullyVerified: true,
              user: {
                id: updatedUser.id,
                userId: updatedUser.userId,
                displayName: updatedUser.displayName,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
              },
            });
            return;
          }
        }
      }

      logAuthEvent("OTP_VERIFIED", { channel, destination, purpose, ip });
      res.json({ success: true, fullyVerified: false });
    } catch (error) {
      console.error("[Auth] OTP verify failed:", error);
      logAuthEvent("OTP_VERIFY_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to verify OTP", errorAr: "فشل التحقق من الرمز" });
    }
  });

  // ─── V1 Register (with pending verification) ─────────────────────
  app.post("/api/v1/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    const rl = rateLimiter.check(`auth:register:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs);
    if (!rl.allowed) {
      logAuthEvent("REGISTER_V1_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many registration attempts. Please try again later.",
        errorAr: "محاولات تسجيل كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password, displayName, name, nameAr, email, phone } = req.body;

      if (!userId || !password || !displayName || !email || !phone) {
        res.status(400).json({
          error: "userId, password, displayName, email, and phone are required",
          errorAr: "معرف المستخدم وكلمة المرور واسم العرض والإيميل ورقم الهاتف مطلوبة",
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: "Password must be at least 6 characters",
          errorAr: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        });
        return;
      }

      // Validate phone E.164
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        res.status(400).json({
          error: "Phone must be in E.164 format (e.g., +966501234567)",
          errorAr: "رقم الهاتف يجب أن يكون بصيغة دولية",
        });
        return;
      }

      // Check if userId already exists
      const existing = await db.getUserByUserId(userId);
      if (existing) {
        res.status(409).json({
          error: "User ID already exists",
          errorAr: "معرف المستخدم موجود مسبقاً",
        });
        return;
      }

      // Check if phone already exists
      const existingPhone = await db.getUserByPhone(phone);
      if (existingPhone) {
        res.status(409).json({
          error: "Phone number already registered",
          errorAr: "رقم الهاتف مسجل مسبقاً",
        });
        return;
      }

      // Check if email already exists
      const existingEmail = await db.getUserByEmail(email);
      if (existingEmail) {
        res.status(409).json({
          error: "Email already registered",
          errorAr: "البريد الإلكتروني مسجل مسبقاً",
        });
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user in pending_verification status
      const newUserId = await db.createLocalUser({
        userId,
        passwordHash,
        displayName,
        name: name || displayName,
        nameAr,
        email,
        phone,
        role: "user",
      });

      if (!newUserId) {
        res.status(500).json({
          error: "Failed to create user",
          errorAr: "فشل إنشاء الحساب",
        });
        return;
      }

      logAuthEvent("REGISTER_V1_SUCCESS", { userId, newUserId, ip, status: "pending_verification" });

      res.json({
        success: true,
        userId: newUserId,
        verificationStatus: "pending",
        phone,
        email,
      });
    } catch (error) {
      console.error("[Auth] V1 Register failed:", error);
      logAuthEvent("REGISTER_V1_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Registration failed",
        errorAr: "فشل التسجيل",
      });
    }
  });

  // ─── OAuth callback removed ──────────────────────────────────────
  // No OAuth routes exist. Any request to /api/oauth/* returns 404 (default Express behavior).
}
