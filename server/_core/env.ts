export const ENV = {
  appId: process.env.VITE_APP_ID ?? "local-app-id",
  cookieSecret: process.env.JWT_SECRET ?? "local-jwt-secret-key-for-development-only-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/monthly_rental",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "http://localhost:3000",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "local-owner-id",
  isProduction: process.env.NODE_ENV === "production",
  // Local development mode - no external API calls
  isLocalMode: !process.env.OAUTH_SERVER_URL || process.env.OAUTH_SERVER_URL === "http://localhost:3000",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "http://localhost:3000",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "local-api-key",
  // SMTP Email Configuration (set via Settings > Secrets)
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "noreply@localhost",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "noreply@localhost",
  smtpSecure: process.env.SMTP_SECURE === "true",
  // Push Notifications (VAPID)
  vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY ?? "local-vapid-public-key",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "local-vapid-private-key",
};
