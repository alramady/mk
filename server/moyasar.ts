/**
 * Moyasar Payment Provider Adapter
 * 
 * Handles payment creation, webhook verification, and refund stubs
 * for mada cards, Apple Pay, and Google Pay in Saudi Arabia.
 * 
 * CRITICAL: Only webhooks can finalize payments (set PAID status).
 * Redirect success page must NOT finalize anything.
 */
import * as db from "./db";
import { getPool } from "./db";
import { createLedgerEntry, updateLedgerStatusSafe } from "./finance-registry";
import { activateExtension } from "./renewal";
import crypto from "crypto";
import type { RowDataPacket } from "mysql2";
import type { Request, Response } from "express";

// ─── Settings ────────────────────────────────────────────────────────

export interface MoyasarSettings {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: "test" | "live";
  currency: string;
  enabled: boolean;
  enableMadaCards: boolean;
  enableApplePay: boolean;
  enableGooglePay: boolean;
  paypalEnabled: boolean;
  cashEnabled: boolean;
}

export async function getMoyasarSettings(): Promise<MoyasarSettings> {
  const map = await db.getAllSettings();
  return {
    publishableKey: map["moyasar.publishableKey"] || "",
    secretKey: map["moyasar.secretKey"] || "",
    webhookSecret: map["moyasar.webhookSecret"] || "",
    mode: (map["moyasar.mode"] || "test") as "test" | "live",
    currency: map["payment.currency"] || "SAR",
    enabled: map["moyasar.enabled"] === "true",
    enableMadaCards: map["moyasar.enableMadaCards"] !== "false", // default true when moyasar enabled
    enableApplePay: map["moyasar.enableApplePay"] === "true",
    enableGooglePay: map["moyasar.enableGooglePay"] === "true",
    paypalEnabled: map["payment.enabled"] === "true",
    cashEnabled: map["payment.cashEnabled"] !== "false",
  };
}

/**
 * Returns the list of available payment methods based on admin toggles and key configuration.
 * Methods appear only if enabled AND keys are configured.
 */
export interface PaymentMethodInfo {
  key: string;
  provider: string;
  label: string;
  labelAr: string;
  logoPath: string;
  displayOrder: number;
  isOnline: boolean; // true for digital payments, false for cash
  comingSoon?: boolean; // true when method is shown as trust badge but keys not yet configured
}

export async function getAvailablePaymentMethods(): Promise<{
  methods: PaymentMethodInfo[];
  moyasarPublishableKey: string | null;
  mode: string;
}> {
  const s = await getMoyasarSettings();
  const methods: PaymentMethodInfo[] = [];
  
  const moyasarConfigured = s.enabled && s.publishableKey && s.secretKey;
  
  if (moyasarConfigured && s.enableMadaCards) {
    methods.push({ key: "mada_card", provider: "moyasar", label: "mada Card", labelAr: "بطاقة مدى", logoPath: "/payment-logos/mada.svg", displayOrder: 1, isOnline: true });
  }
  if (moyasarConfigured && s.enableApplePay) {
    methods.push({ key: "apple_pay", provider: "moyasar", label: "Apple Pay", labelAr: "Apple Pay", logoPath: "/payment-logos/apple-pay.svg", displayOrder: 2, isOnline: true });
  }
  if (moyasarConfigured && s.enableGooglePay) {
    methods.push({ key: "google_pay", provider: "moyasar", label: "Google Pay", labelAr: "Google Pay", logoPath: "/payment-logos/google-pay.svg", displayOrder: 3, isOnline: true });
  }
  if (s.paypalEnabled) {
    const paypalClientId = (await db.getAllSettings())["payment.paypalClientId"];
    if (paypalClientId) {
      methods.push({ key: "paypal", provider: "paypal", label: "PayPal", labelAr: "PayPal", logoPath: "/payment-logos/paypal.svg", displayOrder: 4, isOnline: true });
    }
  }
  if (s.cashEnabled) {
    methods.push({ key: "cash", provider: "manual", label: "Cash on Delivery", labelAr: "الدفع عند الاستلام", logoPath: "", displayOrder: 10, isOnline: false });
  }
  
  return {
    methods,
    moyasarPublishableKey: moyasarConfigured ? s.publishableKey : null,
    mode: s.mode,
  };
}

/**
 * Returns payment method badges for display in footer + property pages.
 * ALWAYS returns core Saudi payment methods (mada, Apple Pay, Google Pay) as trust badges.
 * If Moyasar keys are NOT configured, badges show with comingSoon = true.
 * Checkout buttons remain disabled until keys are configured AND method is enabled.
 */
export async function getEnabledPaymentMethodsForBadges(): Promise<PaymentMethodInfo[]> {
  const s = await getMoyasarSettings();
  const keysConfigured = !!(s.publishableKey && s.secretKey && s.publishableKey.startsWith("pk_") && s.secretKey.startsWith("sk_"));
  const fullyLive = keysConfigured && s.enabled;
  const badges: PaymentMethodInfo[] = [];

  // Always show mada — core Saudi payment method
  if (s.enableMadaCards || !keysConfigured) {
    badges.push({
      key: "mada_card", provider: "moyasar",
      label: "mada Card", labelAr: "\u0628\u0637\u0627\u0642\u0629 \u0645\u062f\u0649",
      logoPath: "/payment-logos/mada.svg",
      displayOrder: 1, isOnline: true,
      comingSoon: !fullyLive,
    });
  }
  // Always show Apple Pay
  if (s.enableApplePay || !keysConfigured) {
    badges.push({
      key: "apple_pay", provider: "moyasar",
      label: "Apple Pay", labelAr: "Apple Pay",
      logoPath: "/payment-logos/apple-pay.svg",
      displayOrder: 2, isOnline: true,
      comingSoon: !fullyLive,
    });
  }
  // Always show Google Pay
  if (s.enableGooglePay || !keysConfigured) {
    badges.push({
      key: "google_pay", provider: "moyasar",
      label: "Google Pay", labelAr: "Google Pay",
      logoPath: "/payment-logos/google-pay.svg",
      displayOrder: 3, isOnline: true,
      comingSoon: !fullyLive,
    });
  }
  return badges.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Returns the Moyasar configuration status for admin dashboard.
 * NOT_CONFIGURED: No keys entered
 * CONFIGURED: Keys entered but not enabled or in test mode
 * LIVE: Keys entered, enabled, and in live mode
 */
export async function getMoyasarConfigStatus(): Promise<{
  status: "NOT_CONFIGURED" | "CONFIGURED" | "LIVE";
  statusAr: string;
  statusEn: string;
  mode: string;
  keysPresent: boolean;
  enabled: boolean;
  webhookUrl: string;
}> {
  const s = await getMoyasarSettings();
  const keysPresent = !!(s.publishableKey && s.secretKey && s.publishableKey.startsWith("pk_") && s.secretKey.startsWith("sk_"));
  
  let status: "NOT_CONFIGURED" | "CONFIGURED" | "LIVE";
  let statusAr: string;
  let statusEn: string;
  
  if (!keysPresent) {
    status = "NOT_CONFIGURED";
    statusAr = "\u063a\u064a\u0631 \u0645\u064f\u0639\u062f";
    statusEn = "Not Configured";
  } else if (!s.enabled || s.mode === "test") {
    status = "CONFIGURED";
    statusAr = s.mode === "test" ? "\u0645\u064f\u0639\u062f (\u062a\u062c\u0631\u064a\u0628\u064a)" : "\u0645\u064f\u0639\u062f (\u0645\u0639\u0637\u0644)";
    statusEn = s.mode === "test" ? "Configured (Test)" : "Configured (Disabled)";
  } else {
    status = "LIVE";
    statusAr = "\u0645\u0628\u0627\u0634\u0631";
    statusEn = "Live";
  }
  
  return {
    status,
    statusAr,
    statusEn,
    mode: s.mode,
    keysPresent,
    enabled: s.enabled,
    webhookUrl: "/api/webhooks/moyasar",
  };
}

// ─── Create Payment ──────────────────────────────────────────────────

export interface CreateMoyasarPaymentParams {
  bookingId: number;
  amount: number; // in SAR (will be converted to halalah)
  description: string;
  descriptionAr?: string;
  callbackUrl: string;
  source: {
    type: "creditcard" | "applepay" | "googlepay";
    // For creditcard (mada): token from Moyasar.js
    token?: string;
    // For applepay: payment data from Apple Pay session
    paymentData?: any;
  };
  metadata?: Record<string, string>;
}

/**
 * Creates a Moyasar payment via their API.
 * Also creates a payment_ledger entry with status=DUE.
 */
export async function createMoyasarPayment(params: CreateMoyasarPaymentParams) {
  const settings = await getMoyasarSettings();
  
  if (!settings.enabled || !settings.publishableKey || !settings.secretKey) {
    throw new Error("Moyasar is not configured. Go to Admin Settings > Payment to set up.");
  }
  
  const amountInHalalah = Math.round(params.amount * 100);
  
  const baseUrl = settings.mode === "live"
    ? "https://api.moyasar.com/v1"
    : "https://api.moyasar.com/v1"; // Same URL, test mode uses test keys
  
  const body: Record<string, any> = {
    amount: amountInHalalah,
    currency: settings.currency,
    description: params.description,
    callback_url: params.callbackUrl,
    source: params.source,
    metadata: {
      bookingId: String(params.bookingId),
      ...params.metadata,
    },
  };
  
  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(settings.secretKey + ":").toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error("[Moyasar] Payment creation failed:", data);
    throw new Error(data.message || "Payment creation failed");
  }
  
  // Create ledger entry with status=DUE
  const pool = getPool();
  if (pool) {
    await pool.query(
      `INSERT INTO payment_ledger (bookingId, type, direction, amount, currency, status, provider, providerRef, paymentMethod, notes, createdAt, updatedAt)
       VALUES (?, 'RENT', 'IN', ?, ?, 'PENDING', 'moyasar', ?, ?, ?, NOW(), NOW())`,
      [
        params.bookingId,
        params.amount.toFixed(2),
        settings.currency,
        data.id,
        params.source.type === "applepay" ? "APPLE_PAY" : params.source.type === "googlepay" ? "GOOGLE_PAY" : "MADA_CARD",
        params.description,
      ]
    );
  }
  
  return {
    paymentId: data.id,
    status: data.status, // "initiated", "paid", "failed"
    transactionUrl: data.source?.transaction_url, // 3DS redirect URL for mada
    amount: data.amount / 100, // back to SAR
  };
}

// ─── Webhook Handler ─────────────────────────────────────────────────

/**
 * Verifies Moyasar webhook signature using HMAC-SHA256.
 * Returns true if signature is valid.
 */
function verifyMoyasarSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/**
 * Handles Moyasar webhook events.
 * ONLY this handler can set payment status to PAID.
 */
export async function handleMoyasarWebhookVerified(req: Request, res: Response) {
  try {
    const settings = await getMoyasarSettings();
    
    // Verify webhook signature
    const signature = req.headers["x-moyasar-signature"] as string || "";
    const rawBody = JSON.stringify(req.body);
    
    if (settings.webhookSecret) {
      const isValid = verifyMoyasarSignature(rawBody, signature, settings.webhookSecret);
      if (!isValid) {
        console.warn("[Moyasar Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("[Moyasar Webhook] No webhook secret configured — skipping signature verification");
    }
    
    const { id, status, amount, source, metadata } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });
    
    // Find ledger entry by providerRef
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'moyasar'",
      [id]
    );
    
    if (!rows[0]) {
      console.log(`[Moyasar Webhook] No ledger entry found for ref: ${id}`);
      return res.status(200).json({ received: true, matched: false });
    }
    
    const ledgerEntry = rows[0];
    
    // Map Moyasar status to our ledger status
    let newStatus: string;
    switch (status) {
      case "paid":
        newStatus = "PAID";
        break;
      case "failed":
        newStatus = "FAILED";
        break;
      case "refunded":
        newStatus = "REFUNDED";
        break;
      case "authorized":
        newStatus = "PENDING";
        break;
      default:
        newStatus = "PENDING";
    }
    
    // Determine payment method from source type
    let paymentMethod = "MADA_CARD";
    if (source?.type === "applepay") paymentMethod = "APPLE_PAY";
    else if (source?.type === "googlepay") paymentMethod = "GOOGLE_PAY";
    else if (source?.type === "creditcard" && source?.company === "mada") paymentMethod = "MADA_CARD";
    
    // Update ledger — ONLY webhook can set PAID
    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod,
      provider: "moyasar",
      providerRef: id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });
    
    // If payment succeeded, update booking status
    if (newStatus === "PAID") {
      const bookingId = ledgerEntry.bookingId || metadata?.bookingId;
      if (bookingId) {
        await pool.query(
          `UPDATE bookings SET paymentStatus = 'paid', status = 'active', updatedAt = NOW() WHERE id = ? AND status = 'approved'`,
          [bookingId]
        );
      }
      
      // If this was a renewal payment, activate the extension
      const [extRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM booking_extensions WHERE ledgerEntryId = ? AND status = 'PAYMENT_PENDING'",
        [ledgerEntry.id]
      );
      if (extRows[0]) {
        await activateExtension(extRows[0].id);
      }
    }
    
    console.log(`[Moyasar Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus} (method: ${paymentMethod})`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Moyasar Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ─── Refund (Stub) ───────────────────────────────────────────────────

/**
 * Refund a Moyasar payment. Stub for Phase 2.
 */
export async function refundMoyasarPayment(paymentRef: string, _amount?: number): Promise<{ success: boolean; message: string }> {
  // TODO: Implement when ready
  // const settings = await getMoyasarSettings();
  // const response = await fetch(`https://api.moyasar.com/v1/payments/${paymentRef}/refund`, { ... });
  console.log(`[Moyasar] Refund requested for ${paymentRef} — stub, not implemented yet`);
  return { success: false, message: "Refund not implemented yet. Process manually via Moyasar dashboard." };
}

// ─── Fetch Payment Status ────────────────────────────────────────────

/**
 * Fetch payment status from Moyasar API (for verification/reconciliation).
 */
export async function fetchMoyasarPaymentStatus(paymentRef: string): Promise<{
  id: string;
  status: string;
  amount: number;
  source: any;
} | null> {
  const settings = await getMoyasarSettings();
  if (!settings.secretKey) return null;
  
  try {
    const response = await fetch(`https://api.moyasar.com/v1/payments/${paymentRef}`, {
      headers: {
        "Authorization": `Basic ${Buffer.from(settings.secretKey + ":").toString("base64")}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
      amount: data.amount / 100,
      source: data.source,
    };
  } catch {
    return null;
  }
}
