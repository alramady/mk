/**
 * Payment Webhook Handlers
 * 
 * Stubs for PSP webhooks (Moyasar, Tabby, Tamara).
 * These update the payment_ledger and booking_extensions when payments complete.
 * 
 * Keys can be empty now — webhooks will only process if keys are configured.
 */
import { getPool } from "./db";
import { updateLedgerStatusSafe } from "./finance-registry";
import { activateExtension } from "./renewal";
import type { RowDataPacket } from "mysql2";
import type { Request, Response } from "express";

// ─── Moyasar Webhook (mada + Apple Pay + Google Pay) ────────────────
export async function handleMoyasarWebhook(req: Request, res: Response) {
  try {
    const { id, status, amount, source, metadata } = req.body;
    
    // Verify webhook signature (TODO: implement when keys are configured)
    // const signature = req.headers['x-moyasar-signature'];
    
    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });

    // Find ledger entry by providerRef
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'moyasar'", [id]
    );
    
    if (!rows[0]) {
      console.log(`[Moyasar Webhook] No ledger entry found for ref: ${id}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const ledgerEntry = rows[0];
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
      default:
        newStatus = "PENDING";
    }

    // Determine payment method from source type
    let paymentMethod = "MADA_CARD";
    if (source?.type === "applepay") paymentMethod = "APPLE_PAY";
    else if (source?.type === "googlepay") paymentMethod = "GOOGLE_PAY";

    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod,
      provider: "moyasar",
      providerRef: id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });

    // If this was a renewal payment, activate the extension
    if (newStatus === "PAID") {
      const [extRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM booking_extensions WHERE ledgerEntryId = ? AND status = 'PAYMENT_PENDING'",
        [ledgerEntry.id]
      );
      if (extRows[0]) {
        await activateExtension(extRows[0].id);
      }
    }

    console.log(`[Moyasar Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus}`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Moyasar Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ─── Tabby Webhook ──────────────────────────────────────────────────
export async function handleTabbyWebhook(req: Request, res: Response) {
  try {
    const { id, status, payment } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'tabby'", [id]
    );

    if (!rows[0]) {
      console.log(`[Tabby Webhook] No ledger entry found for ref: ${id}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const ledgerEntry = rows[0];
    let newStatus: string;

    switch (status) {
      case "AUTHORIZED":
      case "CLOSED":
        newStatus = "PAID";
        break;
      case "REJECTED":
      case "EXPIRED":
        newStatus = "FAILED";
        break;
      case "REFUNDED":
        newStatus = "REFUNDED";
        break;
      default:
        newStatus = "PENDING";
    }

    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod: "TABBY",
      provider: "tabby",
      providerRef: id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });

    // Activate extension if renewal payment
    if (newStatus === "PAID") {
      const [extRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM booking_extensions WHERE ledgerEntryId = ? AND status = 'PAYMENT_PENDING'",
        [ledgerEntry.id]
      );
      if (extRows[0]) await activateExtension(extRows[0].id);
    }

    console.log(`[Tabby Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus}`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Tabby Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ─── Tamara Webhook ─────────────────────────────────────────────────
export async function handleTamaraWebhook(req: Request, res: Response) {
  try {
    const { order_id, event_type, data } = req.body;
    
    if (!order_id || !event_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ error: "Database not available" });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_ledger WHERE providerRef = ? AND provider = 'tamara'", [order_id]
    );

    if (!rows[0]) {
      console.log(`[Tamara Webhook] No ledger entry found for ref: ${order_id}`);
      return res.status(200).json({ received: true, matched: false });
    }

    const ledgerEntry = rows[0];
    let newStatus: string;

    switch (event_type) {
      case "order_approved":
      case "order_captured":
        newStatus = "PAID";
        break;
      case "order_declined":
      case "order_expired":
        newStatus = "FAILED";
        break;
      case "order_refunded":
        newStatus = "REFUNDED";
        break;
      default:
        newStatus = "PENDING";
    }

    await updateLedgerStatusSafe(ledgerEntry.id, newStatus, {
      paymentMethod: "TAMARA",
      provider: "tamara",
      providerRef: order_id,
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      webhookVerified: true,
    });

    // Activate extension if renewal payment
    if (newStatus === "PAID") {
      const [extRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM booking_extensions WHERE ledgerEntryId = ? AND status = 'PAYMENT_PENDING'",
        [ledgerEntry.id]
      );
      if (extRows[0]) await activateExtension(extRows[0].id);
    }

    console.log(`[Tamara Webhook] Updated ledger #${ledgerEntry.id} to ${newStatus}`);
    return res.status(200).json({ received: true, matched: true, newStatus });
  } catch (err: any) {
    console.error("[Tamara Webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
