/**
 * Integration Settings Module
 *
 * CRUD for encrypted provider credentials stored in integration_credentials table.
 * Credentials are encrypted with AES-256-GCM before storage.
 * Read-only by default; writes require ENABLE_INTEGRATION_PANEL_WRITE=true.
 *
 * This module is the ONLY place that calls encrypt/decrypt for credentials.
 */

import { getPool } from "./db";
import { encrypt, decrypt, maskSecret, hashConfig, isEncryptionReady } from "./encryption";
import { logAudit, type AuditAction, type AuditEntityType } from "./audit-log";

// Known integration keys and their expected config fields
export const INTEGRATION_REGISTRY: Record<string, {
  providerName: string;
  fields: { key: string; label: string; labelAr: string; isSecret: boolean }[];
}> = {
  "sms_unifonic": {
    providerName: "Unifonic",
    fields: [
      { key: "appSid", label: "App SID", labelAr: "معرّف التطبيق", isSecret: true },
      { key: "senderId", label: "Sender ID", labelAr: "معرّف المرسل", isSecret: false },
      { key: "baseUrl", label: "Base URL", labelAr: "الرابط الأساسي", isSecret: false },
    ],
  },
  "sms_twilio": {
    providerName: "Twilio",
    fields: [
      { key: "accountSid", label: "Account SID", labelAr: "معرّف الحساب", isSecret: false },
      { key: "authToken", label: "Auth Token", labelAr: "رمز المصادقة", isSecret: true },
      { key: "fromNumber", label: "From Number", labelAr: "رقم المرسل", isSecret: false },
    ],
  },
  "email_smtp": {
    providerName: "SMTP (Google Workspace)",
    fields: [
      { key: "host", label: "SMTP Host", labelAr: "خادم SMTP", isSecret: false },
      { key: "port", label: "SMTP Port", labelAr: "منفذ SMTP", isSecret: false },
      { key: "user", label: "SMTP User", labelAr: "مستخدم SMTP", isSecret: false },
      { key: "pass", label: "SMTP Password", labelAr: "كلمة مرور SMTP", isSecret: true },
      { key: "from", label: "From Address", labelAr: "عنوان المرسل", isSecret: false },
      { key: "secure", label: "Use TLS", labelAr: "استخدام TLS", isSecret: false },
    ],
  },
  "payment_moyasar": {
    providerName: "Moyasar",
    fields: [
      { key: "publishableKey", label: "Publishable Key", labelAr: "المفتاح العام", isSecret: false },
      { key: "secretKey", label: "Secret Key", labelAr: "المفتاح السري", isSecret: true },
      { key: "webhookSecret", label: "Webhook Secret", labelAr: "سر الويب هوك", isSecret: true },
    ],
  },
  "whatsapp_cloud": {
    providerName: "WhatsApp Cloud API",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", labelAr: "معرّف رقم الهاتف", isSecret: false },
      { key: "accessToken", label: "Access Token", labelAr: "رمز الوصول", isSecret: true },
      { key: "businessAccountId", label: "Business Account ID", labelAr: "معرّف حساب الأعمال", isSecret: false },
      { key: "webhookVerifyToken", label: "Webhook Verify Token", labelAr: "رمز تحقق الويب هوك", isSecret: true },
    ],
  },
  "taqnyat_sms": {
    providerName: "Taqnyat SMS (تقنيات)",
    fields: [
      { key: "bearerToken", label: "Bearer Token (API Key)", labelAr: "رمز الوصول (Bearer Token)", isSecret: true },
      { key: "senderName", label: "Sender Name", labelAr: "اسم المرسل", isSecret: false },
      { key: "webhookSafePhrase", label: "Webhook Safe Phrase", labelAr: "عبارة التأكيد للويب هوك", isSecret: false },
    ],
  },
  "taqnyat_whatsapp": {
    providerName: "Taqnyat WhatsApp (تقنيات)",
    fields: [
      { key: "bearerToken", label: "Bearer Token (API Key)", labelAr: "رمز الوصول (Bearer Token)", isSecret: true },
      { key: "webhookMode", label: "Webhook Mode", labelAr: "وضع الويب هوك", isSecret: false },
      { key: "defaultCountryCode", label: "Default Country Code", labelAr: "رمز الدولة الافتراضي", isSecret: false },
    ],
  },
};

/**
 * Get all integration credentials (masked for admin display).
 * Secret fields show masked values; non-secret fields show full values.
 */
export async function getAllIntegrationSettings(): Promise<Array<{
  integrationKey: string;
  providerName: string;
  isEnabled: boolean;
  hasConfig: boolean;
  maskedConfig: Record<string, string>;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  updatedAt: string;
}>> {
  const pool = getPool();
  if (!pool) return [];

  const [rows] = await pool.query<any[]>("SELECT * FROM integration_credentials ORDER BY integrationKey");

  const result = [];
  for (const row of rows) {
    const registry = INTEGRATION_REGISTRY[row.integrationKey];
    let maskedConfig: Record<string, string> = {};

    if (row.encryptedConfig && isEncryptionReady()) {
      const decrypted = decrypt(row.encryptedConfig);
      if (decrypted) {
        try {
          const config = JSON.parse(decrypted);
          for (const field of registry?.fields || []) {
            const val = config[field.key] || "";
            maskedConfig[field.key] = field.isSecret ? maskSecret(val) : val;
          }
        } catch {
          maskedConfig = { _error: "Failed to parse config" };
        }
      } else {
        maskedConfig = { _error: "Decryption failed (wrong key?)" };
      }
    }

    result.push({
      integrationKey: row.integrationKey,
      providerName: row.providerName,
      isEnabled: !!row.isEnabled,
      hasConfig: !!row.encryptedConfig,
      maskedConfig,
      lastTestedAt: row.lastTestedAt?.toISOString() || null,
      lastTestResult: row.lastTestResult || null,
      updatedAt: row.updatedAt?.toISOString() || "",
    });
  }

  // Add missing integrations from registry (not yet in DB)
  for (const [key, reg] of Object.entries(INTEGRATION_REGISTRY)) {
    if (!result.find((r) => r.integrationKey === key)) {
      result.push({
        integrationKey: key,
        providerName: reg.providerName,
        isEnabled: false,
        hasConfig: false,
        maskedConfig: {},
        lastTestedAt: null,
        lastTestResult: null,
        updatedAt: "",
      });
    }
  }

  return result;
}

/**
 * Update integration credentials (encrypted).
 * Requires ENABLE_INTEGRATION_PANEL_WRITE=true and SETTINGS_ENCRYPTION_KEY.
 */
export async function updateIntegrationCredential(params: {
  integrationKey: string;
  config: Record<string, string>;
  isEnabled: boolean;
  updatedBy: number;
  updatedByName: string;
  ipAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEncryptionReady()) {
    return { success: false, error: "SETTINGS_ENCRYPTION_KEY not configured. Cannot encrypt credentials." };
  }

  const pool = getPool();
  if (!pool) return { success: false, error: "Database unavailable" };

  const plainJson = JSON.stringify(params.config);
  const encrypted = encrypt(plainJson);
  if (!encrypted) {
    return { success: false, error: "Encryption failed" };
  }

  const configHashVal = hashConfig(plainJson);
  const registry = INTEGRATION_REGISTRY[params.integrationKey];
  const providerName = registry?.providerName || params.integrationKey;

  try {
    // Upsert
    await pool.execute(
      `INSERT INTO integration_credentials (integrationKey, providerName, encryptedConfig, configHash, isEnabled, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE encryptedConfig=VALUES(encryptedConfig), configHash=VALUES(configHash), isEnabled=VALUES(isEnabled), updatedBy=VALUES(updatedBy)`,
      [params.integrationKey, providerName, encrypted, configHashVal, params.isEnabled, params.updatedBy]
    );

    // Audit log
    await logAudit({
      userId: params.updatedBy,
      userName: params.updatedByName,
      action: "UPDATE" as AuditAction,
      entityType: "INTEGRATION_CREDENTIAL" as AuditEntityType,
      entityId: 0,
      entityLabel: params.integrationKey,
      changes: { isEnabled: { old: "unknown", new: params.isEnabled } },
      metadata: { configHashVal },
      ipAddress: params.ipAddress,
    });

    return { success: true };
  } catch (err) {
    console.error("[IntegrationSettings] Update failed:", err);
    return { success: false, error: "Database update failed" };
  }
}

/**
 * Get decrypted config for a specific integration (internal use only).
 * NEVER expose this to API responses — only used by provider adapters.
 */
export async function getDecryptedConfig(integrationKey: string): Promise<Record<string, string> | null> {
  const pool = getPool();
  if (!pool) return null;

  const [rows] = await pool.query<any[]>(
    "SELECT encryptedConfig, isEnabled FROM integration_credentials WHERE integrationKey = ? LIMIT 1",
    [integrationKey]
  );

  if (rows.length === 0 || !rows[0].encryptedConfig) return null;
  if (!rows[0].isEnabled) return null;

  if (!isEncryptionReady()) return null;

  const decrypted = decrypt(rows[0].encryptedConfig);
  if (!decrypted) return null;

  try {
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
