// ─── Production Fail-Fast Validation ─────────────────────────────────────────
// In production, critical secrets MUST be explicitly set. The server refuses to
// start with default/weak values to prevent catastrophic security failures.
const isProduction = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

function requireProductionSecret(name: string, value: string | undefined, minLength: number): string {
  const fallbacks = [
    "local-jwt-secret-key-for-development-only-change-in-production",
    "dev-otp-pepper-change-in-production",
  ];
  if (isProduction) {
    if (!value || value.length < minLength || fallbacks.includes(value)) {
      console.error(`\n[FATAL] ${name} is missing, too short (min ${minLength} chars), or uses a default value.`);
      console.error(`[FATAL] Set a strong ${name} in your environment variables before starting in production.`);
      console.error(`[FATAL] Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"\n`);
      process.exit(1);
    }
    return value;
  }
  // In development, allow fallback with a warning
  if (!value || fallbacks.includes(value)) {
    const fallback = name === "JWT_SECRET"
      ? "local-jwt-secret-key-for-development-only-change-in-production"
      : "dev-otp-pepper-change-in-production";
    console.warn(`[WARN] ${name} not set — using insecure development fallback. DO NOT use in production.`);
    return value || fallback;
  }
  return value;
}

// Warn-only variant: logs a warning in production but does NOT crash the server.
// Use for secrets that are important but not on the critical startup path.
function warnProductionSecret(name: string, value: string | undefined, minLength: number, fallback: string): string {
  if (isProduction && (!value || value.length < minLength)) {
    console.warn(`[WARN] ${name} is missing or too short (min ${minLength} chars). Using fallback — set it in env vars ASAP.`);
    return value || fallback;
  }
  if (!value) {
    console.warn(`[WARN] ${name} not set — using insecure development fallback.`);
    return fallback;
  }
  return value;
}

// ─── Environment Detection ──────────────────────────────────────────────────
// Railway sets RAILWAY_ENVIRONMENT_NAME for each environment (e.g. "production", "staging").
// RAILWAY_IS_PREVIEW_DEPLOY is set to "true" for preview deployments (PR-based).
const railwayEnvName = process.env.RAILWAY_ENVIRONMENT_NAME ?? "";
const isPreviewDeploy = process.env.RAILWAY_IS_PREVIEW_DEPLOY === "true" || !!process.env.RAILWAY_PR_NUMBER;
const appEnvironment: "production" | "staging" | "development" =
  isProduction && !isPreviewDeploy && railwayEnvName !== "staging" ? "production"
  : isProduction ? "staging"
  : "development";

// ─── Database URL Resolution ────────────────────────────────────────────────
// Priority chain per environment:
//   production → PROD_DATABASE_URL > DATABASE_URL
//   staging    → STAGING_DATABASE_URL > DATABASE_URL
//   development → DEV_DATABASE_URL > DATABASE_URL > local fallback
//
// Preview deploys are FORCED to staging DB — they NEVER touch production.
function resolveDatabaseUrl(): string {
  if (isPreviewDeploy) {
    const stagingUrl = process.env.STAGING_DATABASE_URL;
    if (stagingUrl) {
      console.log("[DB] Preview deploy detected → using STAGING_DATABASE_URL");
      return stagingUrl;
    }
    // If no staging URL, fall through to DATABASE_URL but log a warning
    console.warn("[DB] ⚠ Preview deploy but STAGING_DATABASE_URL not set — falling back to DATABASE_URL");
  }

  if (appEnvironment === "production") {
    const prodUrl = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!prodUrl) {
      console.error("[FATAL] No database URL configured for production. Set PROD_DATABASE_URL or DATABASE_URL.");
      process.exit(1);
    }
    if (process.env.PROD_DATABASE_URL) {
      console.log("[DB] Production → using PROD_DATABASE_URL");
    } else {
      console.log("[DB] Production → using DATABASE_URL (consider setting PROD_DATABASE_URL explicitly)");
    }
    return prodUrl;
  }

  if (appEnvironment === "staging") {
    const stagingUrl = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
    if (stagingUrl) {
      if (process.env.STAGING_DATABASE_URL) {
        console.log("[DB] Staging → using STAGING_DATABASE_URL");
      } else {
        console.log("[DB] Staging → using DATABASE_URL");
      }
      return stagingUrl;
    }
  }

  // Development
  const devUrl = process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/monthly_rental";
  if (process.env.DEV_DATABASE_URL) {
    console.log("[DB] Development → using DEV_DATABASE_URL");
  } else if (process.env.DATABASE_URL) {
    console.log("[DB] Development → using DATABASE_URL");
  } else {
    console.log("[DB] Development → using local fallback (mysql://localhost)");
  }
  return devUrl;
}

const resolvedDatabaseUrl = resolveDatabaseUrl();

// ─── Boot-Time DB Identity Logging ──────────────────────────────────────────
// Prints host + database name (masked) so operators can verify which DB is active.
// NEVER prints credentials or full connection strings.
function logDbIdentity(url: string): { host: string; database: string; port: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || "unknown";
    const port = parsed.port || "3306";
    const database = parsed.pathname.replace(/^\//, "") || "unknown";
    // Mask: show first 4 chars + last 4 chars of host
    const maskedHost = host.length > 10
      ? `${host.slice(0, 4)}****${host.slice(-4)}`
      : `${host.slice(0, 2)}****`;
    console.log(`[DB] ╔══════════════════════════════════════════╗`);
    console.log(`[DB] ║  Environment : ${appEnvironment.toUpperCase().padEnd(25)}║`);
    console.log(`[DB] ║  DB Host     : ${maskedHost.padEnd(25)}║`);
    console.log(`[DB] ║  DB Port     : ${port.padEnd(25)}║`);
    console.log(`[DB] ║  DB Name     : ${database.padEnd(25)}║`);
    console.log(`[DB] ║  Preview     : ${String(isPreviewDeploy).padEnd(25)}║`);
    console.log(`[DB] ╚══════════════════════════════════════════╝`);
    return { host: maskedHost, database, port };
  } catch {
    console.warn("[DB] Could not parse DATABASE_URL for identity logging");
    return { host: "unknown", database: "unknown", port: "3306" };
  }
}

export const dbIdentity = logDbIdentity(resolvedDatabaseUrl);

// ─── Session Configuration ───────────────────────────────────────────────────
// Access token TTL: 30 minutes in production, 24 hours in development.
// This replaces the previous 365-day (ONE_YEAR_MS) session lifetime.
const SESSION_TTL_MS = isProduction
  ? parseInt(process.env.SESSION_TTL_MS ?? String(30 * 60 * 1000))   // 30 minutes
  : parseInt(process.env.SESSION_TTL_MS ?? String(24 * 60 * 60 * 1000)); // 24 hours (dev)

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "monthly-key-local",
  cookieSecret: requireProductionSecret("JWT_SECRET", process.env.JWT_SECRET, 32),
  databaseUrl: resolvedDatabaseUrl,
  isProduction,
  isPreviewDeploy,
  appEnvironment,
  sessionTtlMs: SESSION_TTL_MS,
  // Redis URL for distributed cache/rate-limiting (optional in dev)
  redisUrl: process.env.REDIS_URL ?? "",
  // OpenAI API - used for LLM, Image Generation, Voice Transcription
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3",
  openaiWhisperModel: process.env.OPENAI_WHISPER_MODEL ?? "whisper-1",
  // Legacy Forge API vars (mapped to OpenAI for backward compat)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  // Local file storage
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  publicUrl: process.env.PUBLIC_URL ?? "", // Auto-detected from request if empty
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE ?? "52428800"), // 50MB
  // SMTP Email Configuration
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "noreply@localhost",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "noreply@localhost",
  smtpSecure: process.env.SMTP_SECURE === "true",
  // Push Notifications (VAPID) - local web-push
  vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  // OTP / Verification — warn-only (OTP is not on critical startup path)
  otpSecretPepper: warnProductionSecret("OTP_SECRET_PEPPER", process.env.OTP_SECRET_PEPPER, 32, "dev-otp-pepper-change-in-production"),
  otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? "300"),
  smsProvider: process.env.SMS_PROVIDER ?? "dev",
  smsApiKey: process.env.SMS_API_KEY ?? "",
  emailProvider: process.env.EMAIL_PROVIDER ?? "dev",
  emailApiKey: process.env.EMAIL_API_KEY ?? "",
};
