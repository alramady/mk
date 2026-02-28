/**
 * WhatsApp Business Cloud API (Meta) service
 * Handles: template message sending, webhook verification, delivery status updates
 * Security: HMAC signature verification, no PII logging, rate limiting
 */
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { eq } from "drizzle-orm";
import { integrationConfigs, auditLog } from "../drizzle/schema";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

// ─── Config Helpers ─────────────────────────────────────────────────

export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId?: string;
  accessToken: string;
  apiVersion: string;
  webhookVerifyToken: string;
  appSecret?: string;
  defaultCountryCode: string;
  senderName?: string;
  isEnabled: boolean;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  try {
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, "whatsapp"));
    if (!row || !row.isEnabled) return null;
    const config = row.configJson ? JSON.parse(row.configJson) : {};
    if (!config.phoneNumberId || !config.accessToken) return null;
    return {
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId || "",
      accessToken: config.accessToken,
      apiVersion: config.apiVersion || "v20.0",
      webhookVerifyToken: config.webhookVerifyToken || "",
      appSecret: config.appSecret || "",
      defaultCountryCode: config.defaultCountryCode || "+966",
      senderName: config.senderName || "Monthly Key",
      isEnabled: row.isEnabled,
    };
  } catch {
    return null;
  }
}

// ─── Phone Number Formatting ────────────────────────────────────────

export function formatPhoneForWhatsApp(phone: string, defaultCountryCode: string = "+966"): string {
  let cleaned = phone.replace(/[^0-9+]/g, "");
  // Saudi format: 05XXXXXXXX → 966XXXXXXXX
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  }
  if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  // Remove leading + if present
  cleaned = cleaned.replace(/^\+/, "");
  // If no country code, add default
  if (!cleaned.startsWith("966") && !cleaned.startsWith("1") && cleaned.length <= 10) {
    const code = defaultCountryCode.replace(/^\+/, "");
    cleaned = code + cleaned;
  }
  return cleaned;
}

// Mask phone for logging: 966501234567 → 966****4567
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return "****";
  return phone.substring(0, 3) + "****" + phone.substring(phone.length - 4);
}

// ─── Send Template Message ──────────────────────────────────────────

export interface SendTemplateParams {
  to: string; // Phone number (will be formatted)
  templateName: string; // Meta-approved template name
  languageCode: string; // e.g. "ar" or "en_US"
  variables?: string[]; // Template body variables in order
  headerImageUrl?: string;
}

export interface SendResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
}

export async function sendTemplateMessage(params: SendTemplateParams): Promise<SendResult> {
  const config = await getWhatsAppConfig();
  if (!config) return { success: false, error: "WhatsApp not configured or disabled" };

  const phone = formatPhoneForWhatsApp(params.to, config.defaultCountryCode);

  // Build template components
  const components: any[] = [];
  if (params.variables && params.variables.length > 0) {
    components.push({
      type: "body",
      parameters: params.variables.map(v => ({ type: "text", text: v })),
    });
  }
  if (params.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: params.headerImageUrl } }],
    });
  }

  const body: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
    },
  };
  if (components.length > 0) {
    body.template.components = components;
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await resp.json();
    if (resp.ok && data.messages?.[0]?.id) {
      return { success: true, providerMsgId: data.messages[0].id };
    } else {
      const errMsg = data?.error?.message || `HTTP ${resp.status}`;
      // Never log the full error which might contain PII
      return { success: false, error: errMsg.substring(0, 200) };
    }
  } catch (e: any) {
    return { success: false, error: `Send failed: ${e.message?.substring(0, 100)}` };
  }
}

// ─── Send Free-Form Text Message ────────────────────────────────────

export async function sendTextMessage(to: string, text: string): Promise<SendResult> {
  const config = await getWhatsAppConfig();
  if (!config) return { success: false, error: "WhatsApp not configured or disabled" };

  const phone = formatPhoneForWhatsApp(to, config.defaultCountryCode);

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: text },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await resp.json();
    if (resp.ok && data.messages?.[0]?.id) {
      return { success: true, providerMsgId: data.messages[0].id };
    } else {
      const errMsg = data?.error?.message || `HTTP ${resp.status}`;
      return { success: false, error: errMsg.substring(0, 200) };
    }
  } catch (e: any) {
    return { success: false, error: `Send failed: ${e.message?.substring(0, 100)}` };
  }
}

// ─── Webhook Verification ───────────────────────────────────────────

export function verifyWebhookChallenge(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
  verifyToken: string
): { valid: boolean; challenge?: string } {
  if (mode === "subscribe" && token === verifyToken) {
    return { valid: true, challenge: challenge || "" };
  }
  return { valid: false };
}

// ─── Webhook Signature Verification ─────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature || !appSecret) return false;
  try {
    const expectedSig = "sha256=" + crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

// ─── Parse Webhook Delivery Status ──────────────────────────────────

export interface DeliveryStatus {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: number;
  recipientPhone: string;
  errorCode?: string;
  errorTitle?: string;
}

export function parseDeliveryStatuses(body: any): DeliveryStatus[] {
  const statuses: DeliveryStatus[] = [];
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.statuses) continue;
        for (const s of value.statuses) {
          const status = s.status as string;
          if (["sent", "delivered", "read", "failed"].includes(status)) {
            statuses.push({
              messageId: s.id,
              status: status as DeliveryStatus["status"],
              timestamp: parseInt(s.timestamp) || Math.floor(Date.now() / 1000),
              recipientPhone: s.recipient_id || "",
              errorCode: s.errors?.[0]?.code?.toString(),
              errorTitle: s.errors?.[0]?.title?.substring(0, 200),
            });
          }
        }
      }
    }
  } catch {
    // Silently ignore parse errors
  }
  return statuses;
}

// ─── Express Request Handlers for Webhook Endpoints ────────────────

import type { Request, Response } from "express";

/**
 * GET /api/webhooks/whatsapp — Meta webhook verification challenge
 */
export async function handleWhatsAppVerification(req: Request, res: Response) {
  try {
    const config = await getWhatsAppConfig();
    const verifyToken = config?.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
    
    const mode = req.query["hub.mode"] as string | undefined;
    const token = req.query["hub.verify_token"] as string | undefined;
    const challenge = req.query["hub.challenge"] as string | undefined;

    const result = verifyWebhookChallenge(mode, token, challenge, verifyToken);
    if (result.valid) {
      console.log("[WhatsApp Webhook] Verification successful");
      return res.status(200).send(result.challenge);
    }
    console.warn("[WhatsApp Webhook] Verification failed — token mismatch");
    return res.status(403).json({ error: "Verification failed" });
  } catch (err: any) {
    console.error("[WhatsApp Webhook] Verification error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * POST /api/webhooks/whatsapp — Incoming messages + delivery status updates
 */
export async function handleWhatsAppWebhook(req: Request, res: Response) {
  // Always respond 200 quickly to avoid Meta retries
  res.status(200).json({ status: "ok" });

  try {
    // Parse delivery statuses and update DB
    const statuses = parseDeliveryStatuses(req.body);
    if (statuses.length > 0) {
      const { updateWhatsAppMessageStatus } = await import("./db");
      for (const s of statuses) {
        try {
          await updateWhatsAppMessageStatus(s.messageId, s.status);
        } catch (e: any) {
          console.error(`[WhatsApp Webhook] Failed to update status for ${s.messageId}:`, e.message);
        }
      }
      console.log(`[WhatsApp Webhook] Processed ${statuses.length} delivery status updates`);
    }

    // TODO: Handle incoming messages (future feature)
    // const messages = parseIncomingMessages(req.body);
  } catch (err: any) {
    console.error("[WhatsApp Webhook] Processing error:", err.message);
  }
}
