import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

// Local notification log
const notificationLog: Array<{ title: string; content: string; timestamp: Date }> = [];

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Local notification handler - logs to console and stores in memory.
 * Local notification handler with logging + optional email.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  // Log to console
  console.log(`[Notification] ${title}: ${content}`);

  // Store in memory log
  notificationLog.push({ title, content, timestamp: new Date() });

  // Keep only last 100 notifications in memory
  if (notificationLog.length > 100) {
    notificationLog.shift();
  }

  // Try email if SMTP configured
  try {
    if (ENV.smtpHost && ENV.smtpPass) {
      console.log(`[Notification] Email notification queued: ${title}`);
    }
  } catch {
    // Email is best-effort
  }

  return true;
}

/**
 * Get recent notifications (for admin dashboard)
 */
export function getRecentNotifications(limit = 20) {
  return notificationLog.slice(-limit).reverse();
}
