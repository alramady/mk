export const ENV = {
  appId: process.env.VITE_APP_ID ?? "monthly-key-local",
  cookieSecret: process.env.JWT_SECRET ?? "local-jwt-secret-key-for-development-only-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/monthly_rental",
  isProduction: process.env.NODE_ENV === "production",
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
  // OTP / Verification
  otpSecretPepper: process.env.OTP_SECRET_PEPPER ?? "dev-otp-pepper-change-in-production",
  otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? "300"),
  smsProvider: process.env.SMS_PROVIDER ?? "dev",
  smsApiKey: process.env.SMS_API_KEY ?? "",
  emailProvider: process.env.EMAIL_PROVIDER ?? "dev",
  emailApiKey: process.env.EMAIL_API_KEY ?? "",
};
