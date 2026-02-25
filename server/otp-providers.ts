/**
 * OTP Provider Adapters
 *
 * Phase 1: Dev-mode stubs that log OTP to console.
 * Phase 2: Plug real providers (Twilio/Unifonic + SendGrid/Resend) behind these adapters.
 *
 * NO Manus AI automations/services/SDKs. Standard Node/TypeScript only.
 */
import { ENV } from "./_core/env";

// ─── Interfaces ──────────────────────────────────────────────────────
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  send(to: string, message: string): Promise<SendResult>;
}

export interface EmailOtpProvider {
  send(to: string, subject: string, htmlBody: string): Promise<SendResult>;
}

// ─── Dev SMS Provider (logs to console) ──────────────────────────────
class DevSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<SendResult> {
    console.log(`[OTP-SMS-DEV] → ${to}: ${message}`);
    return { success: true, messageId: `dev-sms-${Date.now()}` };
  }
}

// ─── Dev Email Provider (logs to console) ────────────────────────────
class DevEmailOtpProvider implements EmailOtpProvider {
  async send(to: string, subject: string, htmlBody: string): Promise<SendResult> {
    // Strip HTML for console log
    const textOnly = htmlBody.replace(/<[^>]*>/g, "").trim();
    console.log(`[OTP-EMAIL-DEV] → ${to} | Subject: ${subject} | Body: ${textOnly}`);
    return { success: true, messageId: `dev-email-${Date.now()}` };
  }
}

// ─── SMTP Email Provider (uses existing nodemailer setup) ────────────
class SmtpEmailOtpProvider implements EmailOtpProvider {
  async send(to: string, subject: string, htmlBody: string): Promise<SendResult> {
    try {
      // Dynamic import to avoid circular deps
      const { sendEmail, isSmtpConfigured } = await import("./email");
      if (!isSmtpConfigured()) {
        console.warn("[OTP-EMAIL-SMTP] SMTP not configured, falling back to dev log");
        console.log(`[OTP-EMAIL-SMTP-FALLBACK] → ${to} | Subject: ${subject}`);
        return { success: true, messageId: `smtp-fallback-${Date.now()}` };
      }
      const result = await sendEmail({ to, subject, html: htmlBody });
      return result;
    } catch (err) {
      console.error("[OTP-EMAIL-SMTP] Failed:", err);
      return { success: false, error: String(err) };
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────
export function getSmsProvider(): SmsProvider {
  const provider = ENV.smsProvider.toLowerCase();
  switch (provider) {
    // Future: case "twilio": return new TwilioSmsProvider();
    // Future: case "unifonic": return new UnifonicSmsProvider();
    case "dev":
    default:
      return new DevSmsProvider();
  }
}

export function getEmailOtpProvider(): EmailOtpProvider {
  const provider = ENV.emailProvider.toLowerCase();
  switch (provider) {
    case "smtp":
      return new SmtpEmailOtpProvider();
    // Future: case "sendgrid": return new SendGridEmailProvider();
    // Future: case "resend": return new ResendEmailProvider();
    case "dev":
    default:
      return new DevEmailOtpProvider();
  }
}
