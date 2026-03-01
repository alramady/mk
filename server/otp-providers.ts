/**
 * OTP Provider Adapters
 *
 * Supports multiple SMS and Email providers, configurable via env vars.
 * SMS: Unifonic (Saudi-focused), Twilio (international), Dev (console log)
 * Email: SMTP (nodemailer), Dev (console log)
 *
 * Standard Node/TypeScript only. No external AI dependencies.
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

// ─── Unifonic SMS Provider (Saudi Arabia) ────────────────────────────
class UnifonicSmsProvider implements SmsProvider {
  private appSid: string;
  private senderId: string;
  private baseUrl: string;

  constructor() {
    this.appSid = process.env.UNIFONIC_APP_SID || "";
    this.senderId = process.env.UNIFONIC_SENDER_ID || "MonthlyKey";
    this.baseUrl = process.env.UNIFONIC_BASE_URL || "https://el.cloud.unifonic.com/rest";
  }

  async send(to: string, message: string): Promise<SendResult> {
    if (!this.appSid) {
      console.warn("[OTP-SMS-UNIFONIC] UNIFONIC_APP_SID not configured, falling back to dev log");
      console.log(`[OTP-SMS-UNIFONIC-FALLBACK] → ${to}: ${message}`);
      return { success: true, messageId: `unifonic-fallback-${Date.now()}` };
    }

    try {
      // Normalize Saudi phone numbers
      const normalizedTo = to.startsWith("+") ? to.slice(1) : to;

      const body = new URLSearchParams({
        AppSid: this.appSid,
        SenderID: this.senderId,
        Recipient: normalizedTo,
        Body: message,
      });

      const response = await fetch(`${this.baseUrl}/Messages/Send`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await response.json();

      if (data.success === true || data.Success === true || response.ok) {
        console.log(`[OTP-SMS-UNIFONIC] Sent to ${normalizedTo}, messageId: ${data.data?.MessageID || data.MessageID || "unknown"}`);
        return { success: true, messageId: data.data?.MessageID || data.MessageID || `unifonic-${Date.now()}` };
      } else {
        const errMsg = data.message || data.Message || JSON.stringify(data);
        console.error(`[OTP-SMS-UNIFONIC] Failed: ${errMsg}`);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error("[OTP-SMS-UNIFONIC] Error:", err);
      return { success: false, error: String(err) };
    }
  }
}

// ─── Twilio SMS Provider (International) ─────────────────────────────
class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || "";
  }

  async send(to: string, message: string): Promise<SendResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn("[OTP-SMS-TWILIO] Twilio credentials not configured, falling back to dev log");
      console.log(`[OTP-SMS-TWILIO-FALLBACK] → ${to}: ${message}`);
      return { success: true, messageId: `twilio-fallback-${Date.now()}` };
    }

    try {
      const normalizedTo = to.startsWith("+") ? to : `+${to}`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

      const body = new URLSearchParams({
        To: normalizedTo,
        From: this.fromNumber,
        Body: message,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }
      );

      const data = await response.json();

      if (response.ok && data.sid) {
        console.log(`[OTP-SMS-TWILIO] Sent to ${normalizedTo}, sid: ${data.sid}`);
        return { success: true, messageId: data.sid };
      } else {
        const errMsg = data.message || JSON.stringify(data);
        console.error(`[OTP-SMS-TWILIO] Failed: ${errMsg}`);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      console.error("[OTP-SMS-TWILIO] Error:", err);
      return { success: false, error: String(err) };
    }
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
    case "unifonic":
      return new UnifonicSmsProvider();
    case "twilio":
      return new TwilioSmsProvider();
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
    case "dev":
    default:
      return new DevEmailOtpProvider();
  }
}
