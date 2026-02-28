import { TRPCError } from "@trpc/server";
import { adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { eq } from "drizzle-orm";
import { integrationConfigs, auditLog } from "../drizzle/schema";
import { verifySmtpConnection, isSmtpConfigured } from "./email";
import { testS3Connection, reloadS3Client, getStorageInfo } from "./storage";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

// Default integrations to seed if not present
const DEFAULT_INTEGRATIONS = [
  { integrationKey: 'beds24', displayName: 'Beds24 PMS', displayNameAr: 'نظام إدارة Beds24' },
  { integrationKey: 'moyasar', displayName: 'Moyasar Payments', displayNameAr: 'مدفوعات مُيسّر' },
  { integrationKey: 'email', displayName: 'Email (SMTP)', displayNameAr: 'البريد الإلكتروني (SMTP)' },
  { integrationKey: 'maps', displayName: 'Google Maps', displayNameAr: 'خرائط جوجل' },
  { integrationKey: 'whatsapp', displayName: 'WhatsApp Cloud API', displayNameAr: 'واتساب كلاود API' },
  { integrationKey: 'storage', displayName: 'File Storage (S3/R2)', displayNameAr: 'تخزين الملفات (S3/R2)' },
];

// Mask a secret string: show first 4 and last 4 chars
function maskSecret(val: string | undefined | null): string {
  if (!val) return '';
  if (val.length <= 8) return '****';
  return val.substring(0, 4) + '****' + val.substring(val.length - 4);
}

// Parse config JSON safely
function parseConfig(configJson: string | null): Record<string, string> {
  if (!configJson) return {};
  try { return JSON.parse(configJson); } catch { return {}; }
}

// Mask all secret fields in config
function maskConfig(config: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, val] of Object.entries(config)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
      masked[key] = maskSecret(val);
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

// Get config fields definition for each integration
function getConfigFields(key: string): { name: string; label: string; labelAr: string; isSecret: boolean }[] {
  switch (key) {
    case 'beds24':
      return [
        { name: 'apiUrl', label: 'API URL', labelAr: 'رابط API', isSecret: false },
        { name: 'refreshToken', label: 'Refresh Token', labelAr: 'رمز التحديث', isSecret: true },
        { name: 'webhookSecret', label: 'Webhook Secret', labelAr: 'سر الويب هوك', isSecret: true },
      ];
    case 'moyasar':
      return [
        { name: 'publishableKey', label: 'Publishable Key', labelAr: 'المفتاح العام', isSecret: false },
        { name: 'secretKey', label: 'Secret Key', labelAr: 'المفتاح السري', isSecret: true },
        { name: 'webhookSecret', label: 'Webhook Secret', labelAr: 'سر الويب هوك', isSecret: true },
        { name: 'mode', label: 'Mode (test/live)', labelAr: 'الوضع (تجريبي/حي)', isSecret: false },
        { name: 'enableMada', label: 'Enable Mada', labelAr: 'تفعيل مدى', isSecret: false },
        { name: 'enableApplePay', label: 'Enable Apple Pay', labelAr: 'تفعيل Apple Pay', isSecret: false },
        { name: 'enableGooglePay', label: 'Enable Google Pay', labelAr: 'تفعيل Google Pay', isSecret: false },
      ];
    case 'email':
      return [
        { name: 'smtpHost', label: 'SMTP Host', labelAr: 'خادم SMTP', isSecret: false },
        { name: 'smtpPort', label: 'SMTP Port', labelAr: 'منفذ SMTP', isSecret: false },
        { name: 'smtpUser', label: 'SMTP User', labelAr: 'مستخدم SMTP', isSecret: false },
        { name: 'smtpPassword', label: 'SMTP Password', labelAr: 'كلمة مرور SMTP', isSecret: true },
        { name: 'fromEmail', label: 'From Email', labelAr: 'البريد المرسل', isSecret: false },
      ];
    case 'maps':
      return [
        { name: 'provider', label: 'Provider (GOOGLE/MAPBOX/DISABLED)', labelAr: 'المزود (GOOGLE/MAPBOX/DISABLED)', isSecret: false },
        { name: 'apiKey', label: 'Google Maps API Key', labelAr: 'مفتاح Google Maps API', isSecret: true },
        { name: 'mapboxToken', label: 'Mapbox Access Token', labelAr: 'رمز وصول Mapbox', isSecret: true },
        { name: 'mapId', label: 'Google Map ID (optional)', labelAr: 'معرف الخريطة (اختياري)', isSecret: false },
        { name: 'showOnPropertyPage', label: 'Show on Property Page (true/false)', labelAr: 'عرض في صفحة العقار', isSecret: false },
        { name: 'enableGeocodingInAdmin', label: 'Enable Geocoding (true/false)', labelAr: 'تفعيل الترميز الجغرافي', isSecret: false },
        { name: 'enablePinPickerInAdmin', label: 'Enable Pin Picker (true/false)', labelAr: 'تفعيل اختيار الموقع بالدبوس', isSecret: false },
        { name: 'defaultCity', label: 'Default City', labelAr: 'المدينة الافتراضية', isSecret: false },
        { name: 'defaultCenterLat', label: 'Default Center Lat', labelAr: 'خط العرض الافتراضي', isSecret: false },
        { name: 'defaultCenterLng', label: 'Default Center Lng', labelAr: 'خط الطول الافتراضي', isSecret: false },
        { name: 'defaultZoom', label: 'Default Zoom (1-20)', labelAr: 'مستوى التكبير الافتراضي', isSecret: false },
        { name: 'mapTheme', label: 'Theme (light/dark)', labelAr: 'السمة (فاتح/داكن)', isSecret: false },
        { name: 'geocodeDailyCap', label: 'Daily Geocode Cap', labelAr: 'الحد اليومي للترميز', isSecret: false },
        { name: 'geocodeRateLimitPerAdmin', label: 'Rate Limit per Admin (/min)', labelAr: 'حد المعدل لكل مشرف (/دقيقة)', isSecret: false },
        { name: 'geocodeCacheTTLDays', label: 'Cache TTL (days)', labelAr: 'مدة صلاحية الذاكرة المؤقتة (أيام)', isSecret: false },
      ];
    case 'whatsapp':
      return [
        { name: 'phoneNumberId', label: 'Phone Number ID', labelAr: 'معرف رقم الهاتف', isSecret: false },
        { name: 'businessAccountId', label: 'Business Account ID', labelAr: 'معرف حساب الأعمال', isSecret: false },
        { name: 'accessToken', label: 'Access Token', labelAr: 'رمز الوصول', isSecret: true },
        { name: 'apiVersion', label: 'API Version (e.g. v20.0)', labelAr: 'إصدار API', isSecret: false },
        { name: 'webhookVerifyToken', label: 'Webhook Verify Token', labelAr: 'رمز التحقق من الويب هوك', isSecret: true },
        { name: 'appSecret', label: 'App Secret (Signature Verification)', labelAr: 'سر التطبيق (التحقق من التوقيع)', isSecret: true },
        { name: 'defaultCountryCode', label: 'Default Country Code', labelAr: 'رمز الدولة الافتراضي', isSecret: false },
        { name: 'senderName', label: 'Sender Display Name', labelAr: 'اسم المرسل', isSecret: false },
      ];
    case 'storage':
      return [
        { name: 'endpoint', label: 'S3 Endpoint (e.g. https://xxx.r2.cloudflarestorage.com)', labelAr: 'نقطة الوصول S3', isSecret: false },
        { name: 'bucket', label: 'Bucket Name', labelAr: 'اسم الحاوية', isSecret: false },
        { name: 'accessKeyId', label: 'Access Key ID', labelAr: 'معرف مفتاح الوصول', isSecret: true },
        { name: 'secretAccessKey', label: 'Secret Access Key', labelAr: 'مفتاح الوصول السري', isSecret: true },
        { name: 'region', label: 'Region (default: auto)', labelAr: 'المنطقة', isSecret: false },
        { name: 'publicBaseUrl', label: 'Public/CDN Base URL', labelAr: 'رابط CDN العام', isSecret: false },
      ];
    default:
      return [];
  }
}

export const integrationRouter = router({
  // List all integrations (with masked secrets)
  list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .query(async () => {
      // Ensure defaults exist
      for (const def of DEFAULT_INTEGRATIONS) {
        const existing = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationKey, def.integrationKey));
        if (existing.length === 0) {
          await db.insert(integrationConfigs).values({
            integrationKey: def.integrationKey,
            displayName: def.displayName,
            displayNameAr: def.displayNameAr,
            isEnabled: false,
            status: 'not_configured',
          });
        }
      }
      const all = await db.select().from(integrationConfigs);
      return all.map(item => ({
        ...item,
        configJson: null, // Never send raw config to client
        maskedConfig: maskConfig(parseConfig(item.configJson)),
        configFields: getConfigFields(item.integrationKey),
      }));
    }),

  // Get single integration detail (with masked secrets)
  getById: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      return {
        ...item,
        configJson: null,
        maskedConfig: maskConfig(parseConfig(item.configJson)),
        configFields: getConfigFields(item.integrationKey),
      };
    }),

  // Update integration config
  update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      id: z.number(),
      isEnabled: z.boolean().optional(),
      config: z.record(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const updates: any = {};
      if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;

      if (input.config) {
        // Merge with existing config (don't overwrite masked values)
        const existingConfig = parseConfig(item.configJson);
        const newConfig = { ...existingConfig };
        for (const [key, val] of Object.entries(input.config)) {
          // Skip if value looks like a masked value (contains ****)
          if (val && !val.includes('****')) {
            newConfig[key] = val;
          }
        }
        updates.configJson = JSON.stringify(newConfig);
        // Determine status
        const fields = getConfigFields(item.integrationKey);
        const requiredFields = fields.filter(f => f.isSecret || f.name.includes('Host') || f.name.includes('Url') || f.name.includes('Key'));
        const hasAllRequired = requiredFields.every(f => newConfig[f.name] && newConfig[f.name].length > 0);
        updates.status = hasAllRequired ? 'configured' : 'not_configured';
      }

      await db.update(integrationConfigs).set(updates).where(eq(integrationConfigs.id, input.id));

      // If storage config was updated, reload S3 client with new credentials
      if (item.integrationKey === 'storage' && input.config) {
        const finalConfig = parseConfig(updates.configJson || item.configJson);
        if (finalConfig.bucket && finalConfig.accessKeyId && finalConfig.secretAccessKey) {
          process.env.S3_ENDPOINT = finalConfig.endpoint || '';
          process.env.S3_BUCKET = finalConfig.bucket;
          process.env.S3_ACCESS_KEY_ID = finalConfig.accessKeyId;
          process.env.S3_SECRET_ACCESS_KEY = finalConfig.secretAccessKey;
          process.env.S3_REGION = finalConfig.region || 'auto';
          if (finalConfig.publicBaseUrl) process.env.S3_PUBLIC_BASE_URL = finalConfig.publicBaseUrl;
          reloadS3Client();
        }
      }

      // Audit log (never log secrets)
      await db.insert(auditLog).values({
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.displayName ?? 'system',
        action: input.isEnabled !== undefined ? (input.isEnabled ? 'ENABLE' : 'DISABLE') : 'UPDATE',
        entityType: 'INTEGRATION',
        entityId: input.id,
        entityLabel: item.displayName,
        changes: input.config ? { fields: { old: 'masked', new: Object.keys(input.config).join(', ') } } as any : undefined,
      });

      return { success: true };
    }),

  // Test integration connection
  test: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const config = parseConfig(item.configJson);
      let testResult: { success: boolean; message: string } = { success: false, message: 'Unknown integration' };

      try {
        switch (item.integrationKey) {
          case 'beds24': {
            // Test Beds24 API connectivity
            const apiUrl = config.apiUrl || process.env.BEDS24_API_URL || 'https://beds24.com/api/v2';
            const token = config.refreshToken || process.env.BEDS24_REFRESH_TOKEN;
            if (!token) {
              testResult = { success: false, message: 'No refresh token configured' };
              break;
            }
            try {
              const resp = await fetch(`${apiUrl}/properties`, {
                headers: { 'token': token },
                signal: AbortSignal.timeout(10000),
              });
              if (resp.ok) {
                testResult = { success: true, message: `Connected to Beds24 API. Status: ${resp.status}` };
              } else {
                testResult = { success: false, message: `Beds24 API returned ${resp.status}: ${resp.statusText}` };
              }
            } catch (e: any) {
              testResult = { success: false, message: `Connection failed: ${e.message}` };
            }
            break;
          }
          case 'moyasar': {
            const secretKey = config.secretKey || process.env.MOYASAR_SECRET_KEY;
            if (!secretKey) {
              testResult = { success: false, message: 'No secret key configured' };
              break;
            }
            try {
              const resp = await fetch('https://api.moyasar.com/v1/payments?page=1&per=1', {
                headers: { 'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}` },
                signal: AbortSignal.timeout(10000),
              });
              if (resp.ok || resp.status === 200) {
                testResult = { success: true, message: `Moyasar API connected. Mode: ${config.mode || 'test'}` };
              } else {
                testResult = { success: false, message: `Moyasar API returned ${resp.status}` };
              }
            } catch (e: any) {
              testResult = { success: false, message: `Connection failed: ${e.message}` };
            }
            break;
          }
          case 'email': {
            try {
              if (isSmtpConfigured()) {
                const verified = await verifySmtpConnection();
                testResult = verified
                  ? { success: true, message: 'SMTP connection verified successfully' }
                  : { success: false, message: 'SMTP connection failed' };
              } else {
                testResult = { success: false, message: 'SMTP not configured in environment' };
              }
            } catch (e: any) {
              testResult = { success: false, message: `SMTP test failed: ${e.message}` };
            }
            break;
          }
          case 'maps': {
            try {
              const { testGeocoding } = await import('./maps-service');
              testResult = await testGeocoding();
            } catch (e: any) {
              // Fallback: try direct import
              try {
                const mapsService = await import('./maps-service');
                testResult = await mapsService.testGeocoding();
              } catch (e2: any) {
                testResult = { success: false, message: `Maps test error: ${e2.message}` };
              }
            }
            break;
          }
          case 'whatsapp': {
            const phoneNumberId = config.phoneNumberId;
            const accessToken = config.accessToken;
            const apiVersion = config.apiVersion || 'v20.0';
            if (!phoneNumberId || !accessToken) {
              testResult = { success: false, message: 'Phone Number ID and Access Token are required' };
              break;
            }
            try {
              const resp = await fetch(
                `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`,
                {
                  headers: { 'Authorization': `Bearer ${accessToken}` },
                  signal: AbortSignal.timeout(10000),
                }
              );
              if (resp.ok) {
                const data = await resp.json();
                const displayPhone = data.display_phone_number || phoneNumberId;
                testResult = { success: true, message: `Connected. Phone: ${displayPhone}, Status: ${data.quality_rating || 'OK'}` };
              } else {
                const errData = await resp.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `HTTP ${resp.status}`;
                testResult = { success: false, message: `WhatsApp API error: ${errMsg}` };
              }
            } catch (e: any) {
              testResult = { success: false, message: `Connection failed: ${e.message}` };
            }
            break;
          }
          case 'storage': {
            const endpoint = config.endpoint;
            const bucket = config.bucket;
            const accessKeyId = config.accessKeyId;
            const secretAccessKey = config.secretAccessKey;
            const region = config.region || 'auto';
            if (!bucket || !accessKeyId || !secretAccessKey) {
              testResult = { success: false, message: 'Bucket, Access Key ID, and Secret Access Key are required' };
              break;
            }
            testResult = await testS3Connection({ endpoint, bucket, accessKeyId, secretAccessKey, region });
            if (testResult.success) {
              // Also set env vars so storage.ts picks them up
              process.env.S3_ENDPOINT = endpoint;
              process.env.S3_BUCKET = bucket;
              process.env.S3_ACCESS_KEY_ID = accessKeyId;
              process.env.S3_SECRET_ACCESS_KEY = secretAccessKey;
              process.env.S3_REGION = region;
              if (config.publicBaseUrl) process.env.S3_PUBLIC_BASE_URL = config.publicBaseUrl;
              reloadS3Client();
            }
            break;
          }
          default:
            testResult = { success: false, message: `No test available for ${item.integrationKey}` };
        }
      } catch (e: any) {
        testResult = { success: false, message: `Test error: ${e.message}` };
      }

      // Update status and last tested
      await db.update(integrationConfigs).set({
        status: testResult.success ? 'healthy' : 'failing',
        lastTestedAt: new Date(),
        lastError: testResult.success ? null : testResult.message,
      }).where(eq(integrationConfigs.id, input.id));

      // Audit log
      await db.insert(auditLog).values({
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.displayName ?? 'system',
        action: 'TEST',
        entityType: 'INTEGRATION',
        entityId: input.id,
        entityLabel: item.displayName,
        metadata: { result: testResult.success ? 'healthy' : 'failing', message: testResult.message } as any,
      });

      return testResult;
    }),
});
