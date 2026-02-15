import webpush from "web-push";
import { drizzle } from "drizzle-orm/mysql2";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(process.env.DATABASE_URL!);
  return _db;
}

// ─── Push Notification Helper ────────────────────────────────────────
// Uses VAPID keys from environment variables (auto-configured)

const VAPID_PUBLIC = process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    "mailto:noreply@monthly-key.sa",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE);
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/**
 * Save a push subscription for a user
 */
export async function savePushSubscription(userId: number, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  // Remove existing subscription for this endpoint
  const db = getDb();
  const existing = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  
  // Check if endpoint already exists for this user
  const alreadyExists = existing.some((s: any) => s.endpoint === subscription.endpoint);
  if (alreadyExists) return { success: true, message: "Already subscribed" };

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  return { success: true, message: "Subscribed" };
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(userId: number, endpoint: string) {
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  
  for (const sub of subs) {
    if (sub.endpoint === endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    }
  }
  return { success: true };
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushConfigured()) {
    console.warn("[Push] VAPID keys not configured");
    return { sent: 0, failed: 0 };
  }

  const db = getDb();
  const subs = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error: any) {
      failed++;
      // Remove invalid subscriptions (410 Gone or 404)
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
      console.error(`[Push] Failed to send to user ${userId}:`, error.message);
    }
  }

  return { sent, failed };
}

/**
 * Send push notification to all users (broadcast)
 */
export async function sendPushBroadcast(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushConfigured()) {
    console.warn("[Push] VAPID keys not configured");
    return { sent: 0, failed: 0 };
  }

  const db = getDb();
  const allSubs = await db.select().from(pushSubscriptions);
  let sent = 0;
  let failed = 0;

  for (const sub of allSubs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error: any) {
      failed++;
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return { sent, failed };
}

/**
 * Get subscription count for a user
 */
export async function getUserSubscriptionCount(userId: number): Promise<number> {
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return subs.length;
}
