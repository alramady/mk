/**
 * Taqnyat Communications Service
 *
 * Integrates with Taqnyat (تقنيات) platform for:
 * - SMS sending via REST API
 * - WhatsApp Business messaging via REST API
 * - OTP verification via Verify API
 * - Webhook handlers for SMS delivery callbacks and WhatsApp incoming messages
 *
 * Configuration is stored in the integration_configs table (encrypted).
 * Feature flags TAQNYAT_SMS_ENABLED and TAQNYAT_WHATSAPP_ENABLED control activation.
 *
 * API Docs: https://dev.taqnyat.sa/
 */
import type { Request, Response } from "express";
import { isFlagOn } from "./feature-flags";

// ─── Constants ──────────────────────────────────────────────────────
const TAQNYAT_SMS_BASE_URL = "https://api.taqnyat.sa";
const TAQNYAT_WHATSAPP_BASE_URL = "https://api.taqnyat.sa/wa/v2";
const TAQNYAT_VERIFY_BASE_URL = "https://api.taqnyat.sa";

// ─── Types ──────────────────────────────────────────────────────────
export interface TaqnyatSmsConfig {
  bearerToken: string;
  senderName: string;
  webhookSafePhrase: string;
  isEnabled: boolean;
}

export interface TaqnyatWhatsAppConfig {
  bearerToken: string;
  webhookMode: "chatbot_livechat" | "livechat_only" | "other";
  defaultCountryCode: string;
  isEnabled: boolean;
}

export interface TaqnyatSendResult {
  success: boolean;
  messageId?: string | number;
  cost?: number;
  currency?: string;
  error?: string;
  statusCode?: number;
}

export interface TaqnyatVerifyResult {
  success: boolean;
  verifyId?: string;
  error?: string;
}

// ─── Config Helpers ─────────────────────────────────────────────────

/**
 * Get Taqnyat SMS config from integration_configs table.
 * Returns null if not configured or disabled.
 */
export async function getTaqnyatSmsConfig(): Promise<TaqnyatSmsConfig | null> {
  try {
    const enabled = await isFlagOn("TAQNYAT_SMS_ENABLED");
    if (!enabled) return null;

    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return null;

    const { integrationConfigs } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, "taqnyat_sms"));

    if (!row || !row.isEnabled) return null;
    const config = row.configJson ? JSON.parse(row.configJson) : {};
    if (!config.bearerToken) return null;

    return {
      bearerToken: config.bearerToken,
      senderName: config.senderName || "MonthlyKey",
      webhookSafePhrase: config.webhookSafePhrase || "",
      isEnabled: row.isEnabled,
    };
  } catch (err) {
    console.error("[Taqnyat SMS] Failed to load config:", err);
    return null;
  }
}

/**
 * Get Taqnyat WhatsApp config from integration_configs table.
 * Returns null if not configured or disabled.
 */
export async function getTaqnyatWhatsAppConfig(): Promise<TaqnyatWhatsAppConfig | null> {
  try {
    const enabled = await isFlagOn("TAQNYAT_WHATSAPP_ENABLED");
    if (!enabled) return null;

    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return null;

    const { integrationConfigs } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, "taqnyat_whatsapp"));

    if (!row || !row.isEnabled) return null;
    const config = row.configJson ? JSON.parse(row.configJson) : {};
    if (!config.bearerToken) return null;

    return {
      bearerToken: config.bearerToken,
      webhookMode: config.webhookMode || "other",
      defaultCountryCode: config.defaultCountryCode || "+966",
      isEnabled: row.isEnabled,
    };
  } catch (err) {
    console.error("[Taqnyat WhatsApp] Failed to load config:", err);
    return null;
  }
}

// ─── Phone Number Formatting ────────────────────────────────────────

/**
 * Format phone number for Taqnyat API (international format without 00 or +).
 * Example: "0551234567" → "966551234567"
 */
export function formatPhoneForTaqnyat(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");

  // Saudi format: 05XXXXXXXX → 966XXXXXXXX
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  }
  // Short Saudi: 5XXXXXXXX → 966XXXXXXXX
  if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  // Remove leading 00 if present
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  return cleaned;
}

// ─── SMS API ────────────────────────────────────────────────────────

/**
 * Send SMS message via Taqnyat API.
 * POST https://api.taqnyat.sa/v1/messages
 */
export async function sendTaqnyatSms(
  recipients: string[],
  body: string,
  scheduledDatetime?: string
): Promise<TaqnyatSendResult> {
  const config = await getTaqnyatSmsConfig();
  if (!config) {
    return { success: false, error: "Taqnyat SMS not configured or disabled" };
  }

  const formattedRecipients = recipients.map(formatPhoneForTaqnyat);

  const payload: Record<string, any> = {
    recipients: formattedRecipients,
    body,
    sender: config.senderName,
  };
  if (scheduledDatetime) {
    payload.scheduledDatetime = scheduledDatetime;
  }

  try {
    const resp = await fetch(`${TAQNYAT_SMS_BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    if (resp.status === 201 || data.statusCode === 201) {
      console.log(`[Taqnyat SMS] Sent successfully. MessageId: ${data.messageId}, Cost: ${data.cost} ${data.currency}`);
      return {
        success: true,
        messageId: data.messageId,
        cost: data.cost,
        currency: data.currency,
        statusCode: data.statusCode,
      };
    }

    console.error(`[Taqnyat SMS] Send failed. Status: ${data.statusCode}, Message: ${data.message}`);
    return {
      success: false,
      error: data.message || `HTTP ${resp.status}`,
      statusCode: data.statusCode,
    };
  } catch (err: any) {
    console.error("[Taqnyat SMS] Request failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check Taqnyat account balance.
 * GET https://api.taqnyat.sa/account/balance
 */
export async function getTaqnyatBalance(bearerToken: string): Promise<{
  success: boolean;
  balance?: string;
  currency?: string;
  accountStatus?: string;
  error?: string;
}> {
  try {
    const resp = await fetch(`${TAQNYAT_SMS_BASE_URL}/account/balance`, {
      headers: { "Authorization": `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10000),
    });

    const data = await resp.json();

    if (resp.ok && data.statusCode === 200) {
      return {
        success: true,
        balance: data.balance,
        currency: data.currency,
        accountStatus: data.accountStatus,
      };
    }

    return { success: false, error: data.message || `HTTP ${resp.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get Taqnyat sender names.
 * GET https://api.taqnyat.sa/v1/messages/senders
 */
export async function getTaqnyatSenders(bearerToken: string): Promise<{
  success: boolean;
  senders?: Array<{ senderName: string; status: string; destination: string }>;
  error?: string;
}> {
  try {
    const resp = await fetch(`${TAQNYAT_SMS_BASE_URL}/v1/messages/senders`, {
      headers: { "Authorization": `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10000),
    });

    const data = await resp.json();

    if (resp.ok && data.statusCode === 201) {
      return { success: true, senders: data.senders };
    }

    return { success: false, error: data.message || `HTTP ${resp.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── WhatsApp API ───────────────────────────────────────────────────

/**
 * Send WhatsApp template text message via Taqnyat API.
 * POST https://api.taqnyat.sa/wa/v2/template/text
 */
export async function sendTaqnyatWhatsAppTemplate(
  recipient: string,
  templateName: string,
  language: string = "ar",
  bodyParams?: string[]
): Promise<TaqnyatSendResult> {
  const config = await getTaqnyatWhatsAppConfig();
  if (!config) {
    return { success: false, error: "Taqnyat WhatsApp not configured or disabled" };
  }

  const formattedRecipient = formatPhoneForTaqnyat(recipient);

  const payload: Record<string, any> = {
    recipient: formattedRecipient,
    templateName,
    language,
  };
  if (bodyParams && bodyParams.length > 0) {
    payload.body = bodyParams;
  }

  try {
    const resp = await fetch(`${TAQNYAT_WHATSAPP_BASE_URL}/template/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    if (resp.ok || data.statusCode === 200 || data.statusCode === 201) {
      console.log(`[Taqnyat WhatsApp] Template sent to ${formattedRecipient.substring(0, 3)}****`);
      return { success: true, messageId: data.messageId, statusCode: data.statusCode };
    }

    console.error(`[Taqnyat WhatsApp] Template send failed: ${data.message}`);
    return { success: false, error: data.message || `HTTP ${resp.status}`, statusCode: data.statusCode };
  } catch (err: any) {
    console.error("[Taqnyat WhatsApp] Template request failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send WhatsApp conversation text message via Taqnyat API.
 * POST https://api.taqnyat.sa/wa/v2/conversation/text
 * Note: Only works within 24-hour customer-initiated session window.
 */
export async function sendTaqnyatWhatsAppText(
  recipient: string,
  message: string
): Promise<TaqnyatSendResult> {
  const config = await getTaqnyatWhatsAppConfig();
  if (!config) {
    return { success: false, error: "Taqnyat WhatsApp not configured or disabled" };
  }

  const formattedRecipient = formatPhoneForTaqnyat(recipient);

  try {
    const resp = await fetch(`${TAQNYAT_WHATSAPP_BASE_URL}/conversation/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({ recipient: formattedRecipient, body: message }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    if (resp.ok || data.statusCode === 200 || data.statusCode === 201) {
      console.log(`[Taqnyat WhatsApp] Text sent to ${formattedRecipient.substring(0, 3)}****`);
      return { success: true, messageId: data.messageId, statusCode: data.statusCode };
    }

    console.error(`[Taqnyat WhatsApp] Text send failed: ${data.message}`);
    return { success: false, error: data.message || `HTTP ${resp.status}`, statusCode: data.statusCode };
  } catch (err: any) {
    console.error("[Taqnyat WhatsApp] Text request failed:", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Verify (OTP) API ───────────────────────────────────────────────

/**
 * Send OTP via Taqnyat Verify API.
 * POST https://api.taqnyat.sa/verify/send
 */
export async function sendTaqnyatOtp(
  recipient: string,
  channel: "sms" | "whatsapp" = "sms"
): Promise<TaqnyatVerifyResult> {
  const config = channel === "whatsapp"
    ? await getTaqnyatWhatsAppConfig()
    : await getTaqnyatSmsConfig();

  if (!config) {
    return { success: false, error: `Taqnyat ${channel} not configured or disabled` };
  }

  const formattedRecipient = formatPhoneForTaqnyat(recipient);

  try {
    const resp = await fetch(`${TAQNYAT_VERIFY_BASE_URL}/verify/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({ recipient: formattedRecipient, channel }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    if (resp.ok) {
      return { success: true, verifyId: data.verifyId || data.id };
    }

    return { success: false, error: data.message || `HTTP ${resp.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify OTP code via Taqnyat Verify API.
 * POST https://api.taqnyat.sa/verify/check
 */
export async function verifyTaqnyatOtp(
  verifyId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  // Use SMS config bearer token for verification
  const config = await getTaqnyatSmsConfig();
  if (!config) {
    return { success: false, error: "Taqnyat not configured or disabled" };
  }

  try {
    const resp = await fetch(`${TAQNYAT_VERIFY_BASE_URL}/verify/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({ id: verifyId, code }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    if (resp.ok && data.status === "approved") {
      return { success: true };
    }

    return { success: false, error: data.message || "Verification failed" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── SMS Provider (for otp-providers.ts integration) ────────────────

/**
 * Taqnyat SMS Provider class — compatible with the SmsProvider interface
 * in otp-providers.ts for use as an OTP delivery channel.
 */
export class TaqnyatSmsProvider {
  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const result = await sendTaqnyatSms([to], message);
    return {
      success: result.success,
      messageId: result.messageId?.toString(),
      error: result.error,
    };
  }
}

// ─── Webhook Handlers ───────────────────────────────────────────────

/**
 * POST /api/webhooks/taqnyat/sms
 *
 * Handles SMS delivery status callbacks from Taqnyat.
 * Taqnyat requires a "safe phrase" response to confirm receipt.
 * If the phrase is not returned, Taqnyat retries up to 3 times.
 */
export async function handleTaqnyatSmsWebhook(req: Request, res: Response) {
  try {
    const config = await getTaqnyatSmsConfig();

    if (!config) {
      console.warn("[Taqnyat SMS Webhook] Service disabled or not configured — rejecting");
      return res.status(503).json({ error: "Service disabled" });
    }

    // Log the incoming webhook payload for debugging
    console.log("[Taqnyat SMS Webhook] Received:", JSON.stringify(req.body).substring(0, 500));

    // Process the delivery status update
    const payload = req.body;
    if (payload) {
      try {
        const { logAudit } = await import("./audit-log");
        await logAudit({
          userId: 0,
          userName: "taqnyat-webhook",
          action: "CREATE" as any,
          entityType: "WEBHOOK_EVENT" as any,
          entityId: 0,
          entityLabel: "taqnyat_sms_callback",
          changes: {
            messageId: payload.messageId || payload.msgid || "unknown",
            status: payload.status || payload.dlrStatus || "unknown",
            recipient: payload.recipient || payload.to || "unknown",
          },
          metadata: { source: "taqnyat_sms", timestamp: new Date().toISOString() },
        });
      } catch (auditErr) {
        console.error("[Taqnyat SMS Webhook] Audit log failed:", auditErr);
      }
    }

    // Respond with the safe phrase to confirm receipt
    // Taqnyat requires this phrase; otherwise it retries up to 3 times
    if (config.webhookSafePhrase) {
      return res.status(200).send(config.webhookSafePhrase);
    }

    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("[Taqnyat SMS Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * POST /api/webhooks/taqnyat/whatsapp
 *
 * Handles incoming WhatsApp messages and status updates from Taqnyat.
 * Payload format depends on webhook mode (chatbot+livechat, livechat only, other).
 */
export async function handleTaqnyatWhatsAppWebhook(req: Request, res: Response) {
  try {
    const config = await getTaqnyatWhatsAppConfig();

    if (!config) {
      console.warn("[Taqnyat WhatsApp Webhook] Service disabled or not configured — rejecting");
      return res.status(503).json({ error: "Service disabled" });
    }

    // Respond 200 immediately to prevent Taqnyat retries
    res.status(200).json({ status: "ok" });

    // Log the incoming webhook payload
    const payload = req.body;
    console.log("[Taqnyat WhatsApp Webhook] Received:", JSON.stringify(payload).substring(0, 500));

    // Process the incoming message/status update
    if (payload) {
      try {
        const { logAudit } = await import("./audit-log");

        // Determine message type from payload
        const messageType = payload.type || payload.messageType || "unknown";
        const senderPhone = payload.from || payload.sender || payload.mobile || "unknown";
        const messageBody = payload.body || payload.text || payload.message || "";

        await logAudit({
          userId: 0,
          userName: "taqnyat-webhook",
          action: "CREATE" as any,
          entityType: "WEBHOOK_EVENT" as any,
          entityId: 0,
          entityLabel: "taqnyat_whatsapp_incoming",
          changes: {
            type: messageType,
            from: senderPhone,
            bodyPreview: messageBody.substring(0, 100),
          },
          metadata: {
            source: "taqnyat_whatsapp",
            webhookMode: config.webhookMode,
            timestamp: new Date().toISOString(),
          },
        });

        // TODO: Route incoming messages to conversation system or chatbot
        // This is where you'd integrate with the existing conversations/messages tables
        // or trigger automated responses based on message content.

      } catch (auditErr) {
        console.error("[Taqnyat WhatsApp Webhook] Audit log failed:", auditErr);
      }
    }
  } catch (err: any) {
    console.error("[Taqnyat WhatsApp Webhook] Error:", err.message);
    // Don't send error response — we already sent 200
  }
}

/**
 * Test Taqnyat SMS connection by checking account balance.
 */
export async function testTaqnyatSmsConnection(bearerToken: string): Promise<{
  success: boolean;
  message: string;
}> {
  const result = await getTaqnyatBalance(bearerToken);
  if (result.success) {
    return {
      success: true,
      message: `Connected. Balance: ${result.balance} ${result.currency}. Account: ${result.accountStatus}`,
    };
  }
  return { success: false, message: result.error || "Connection failed" };
}

/**
 * Test Taqnyat WhatsApp connection by checking account balance.
 */
export async function testTaqnyatWhatsAppConnection(bearerToken: string): Promise<{
  success: boolean;
  message: string;
}> {
  // WhatsApp uses the same balance endpoint
  const result = await getTaqnyatBalance(bearerToken);
  if (result.success) {
    return {
      success: true,
      message: `Connected. Balance: ${result.balance} ${result.currency}. Account: ${result.accountStatus}`,
    };
  }
  return { success: false, message: result.error || "Connection failed" };
}
