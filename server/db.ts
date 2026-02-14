import { eq, and, desc, asc, like, gte, lte, inArray, sql, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  properties, InsertProperty,
  bookings, InsertBooking,
  payments, InsertPayment,
  messages, InsertMessage, conversations,
  maintenanceRequests, InsertMaintenanceRequest,
  favorites, reviews, notifications, savedSearches,
  propertyAvailability, platformSettings,
  aiConversations, aiMessages, knowledgeBase, InsertKnowledgeBase,
  userActivities, InsertUserActivity, adminPermissions, InsertAdminPermission, districts, InsertDistrict,
  cities, InsertCity,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "phone", "nameAr", "avatarUrl", "bio", "bioAr"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    (values as any)[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "landlord" | "tenant") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  const { openId, id, ...updateData } = data as any;
  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function getAllUsers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function getUserCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return result[0]?.count ?? 0;
}

// ─── Properties ──────────────────────────────────────────────────────
export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(properties).values(data);
  return result[0].insertId;
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set(data).where(eq(properties.id, id));
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertiesByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(properties).where(eq(properties.landlordId, landlordId)).orderBy(desc(properties.createdAt));
}

export async function searchProperties(filters: {
  city?: string; propertyType?: string; minPrice?: number; maxPrice?: number;
  bedrooms?: number; furnishedLevel?: string; status?: string;
  limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(properties.status, "active")];
  if (filters.city) conditions.push(like(properties.city, `%${filters.city}%`));
  if (filters.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType as any));
  if (filters.minPrice) conditions.push(gte(properties.monthlyRent, String(filters.minPrice)));
  if (filters.maxPrice) conditions.push(lte(properties.monthlyRent, String(filters.maxPrice)));
  if (filters.bedrooms) conditions.push(eq(properties.bedrooms, filters.bedrooms));
  if (filters.furnishedLevel) conditions.push(eq(properties.furnishedLevel, filters.furnishedLevel as any));
  const where = and(...conditions);
  const items = await db.select().from(properties).where(where!)
    .orderBy(desc(properties.createdAt))
    .limit(filters.limit ?? 20).offset(filters.offset ?? 0);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(properties).where(where!);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getAllProperties(limit = 50, offset = 0, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = status ? [eq(properties.status, status as any)] : [];
  return db.select().from(properties)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(properties.createdAt)).limit(limit).offset(offset);
}

export async function getPropertyCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = status ? [eq(properties.status, status as any)] : [];
  const result = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(conditions.length ? and(...conditions) : undefined);
  return result[0]?.count ?? 0;
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(properties).where(eq(properties.id, id));
}

export async function incrementPropertyViews(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set({ viewCount: sql`${properties.viewCount} + 1` }).where(eq(properties.id, id));
}

// ─── Favorites ───────────────────────────────────────────────────────
export async function addFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(favorites).values({ userId, propertyId });
}

export async function removeFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)));
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const favs = await db.select().from(favorites).where(eq(favorites.userId, userId));
  if (favs.length === 0) return [];
  const propIds = favs.map(f => f.propertyId);
  return db.select().from(properties).where(inArray(properties.id, propIds));
}

export async function isFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId))).limit(1);
  return result.length > 0;
}

// ─── Bookings ────────────────────────────────────────────────────────
export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(bookings).values(data);
  return result[0].insertId;
}

export async function updateBooking(id: number, data: Partial<InsertBooking>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set(data).where(eq(bookings.id, id));
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.tenantId, tenantId)).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.landlordId, landlordId)).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.propertyId, propertyId)).orderBy(desc(bookings.createdAt));
}

export async function getAllBookings(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset);
}

export async function getBookingCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = status ? [eq(bookings.status, status as any)] : [];
  const result = await db.select({ count: sql<number>`count(*)` }).from(bookings)
    .where(conditions.length ? and(...conditions) : undefined);
  return result[0]?.count ?? 0;
}

// ─── Payments ────────────────────────────────────────────────────────
export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(payments).values(data);
  return result[0].insertId;
}

export async function updatePayment(id: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.tenantId, tenantId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.landlordId, landlordId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentsByBooking(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt));
}

export async function getTotalRevenue() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(payments)
    .where(eq(payments.status, "completed"));
  return result[0]?.total ?? 0;
}

// ─── Conversations & Messages ────────────────────────────────────────
export async function getOrCreateConversation(tenantId: number, landlordId: number, propertyId?: number) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(conversations.tenantId, tenantId), eq(conversations.landlordId, landlordId)];
  if (propertyId) conditions.push(eq(conversations.propertyId, propertyId));
  const existing = await db.select().from(conversations).where(and(...conditions)).limit(1);
  if (existing.length > 0) return existing[0];
  const result = await db.insert(conversations).values({ tenantId, landlordId, propertyId });
  const newConv = await db.select().from(conversations).where(eq(conversations.id, result[0].insertId)).limit(1);
  return newConv[0] ?? null;
}

export async function getConversationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations)
    .where(or(eq(conversations.tenantId, userId), eq(conversations.landlordId, userId)))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getMessagesByConversation(conversationId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt)).limit(limit).offset(offset);
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(messages).values(data);
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return result[0].insertId;
}

export async function markMessagesAsRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ isRead: true })
    .where(and(eq(messages.conversationId, conversationId), sql`${messages.senderId} != ${userId}`));
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const userConvs = await getConversationsByUser(userId);
  if (userConvs.length === 0) return 0;
  const convIds = userConvs.map(c => c.id);
  const result = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(and(inArray(messages.conversationId, convIds), eq(messages.isRead, false), sql`${messages.senderId} != ${userId}`));
  return result[0]?.count ?? 0;
}

// ─── Maintenance Requests ────────────────────────────────────────────
export async function createMaintenanceRequest(data: InsertMaintenanceRequest) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(maintenanceRequests).values(data);
  return result[0].insertId;
}

export async function updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(maintenanceRequests).set(data).where(eq(maintenanceRequests.id, id));
}

export async function getMaintenanceByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.createdAt));
}

export async function getMaintenanceByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.landlordId, landlordId)).orderBy(desc(maintenanceRequests.createdAt));
}

export async function getMaintenanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Reviews ─────────────────────────────────────────────────────────
export async function createReview(data: { propertyId: number; tenantId: number; bookingId?: number; rating: number; comment?: string; commentAr?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(reviews).values(data);
  return result[0].insertId;
}

export async function getReviewsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true))).orderBy(desc(reviews.createdAt));
}

export async function getAverageRating(propertyId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ avg: sql<number>`COALESCE(AVG(rating), 0)` }).from(reviews)
    .where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true)));
  return result[0]?.avg ?? 0;
}

// ─── Notifications ───────────────────────────────────────────────────
export async function createNotification(data: { userId: number; type: string; titleEn: string; titleAr?: string; contentEn?: string; contentAr?: string; relatedId?: number; relatedType?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(data as any);
  return result[0].insertId;
}

export async function getNotificationsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

// ─── Saved Searches ──────────────────────────────────────────────────
export async function createSavedSearch(userId: number, name: string, filters: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(savedSearches).values({ userId, name, filters });
  return result[0].insertId;
}

export async function getSavedSearches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
}

export async function deleteSavedSearch(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}

// ─── Property Availability ──────────────────────────────────────────
export async function getPropertyAvailability(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(propertyAvailability)
    .where(eq(propertyAvailability.propertyId, propertyId))
    .orderBy(asc(propertyAvailability.startDate));
}

export async function setPropertyAvailability(data: { propertyId: number; startDate: Date; endDate: Date; isBlocked?: boolean; priceOverride?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertyAvailability).values(data);
  return result[0].insertId;
}

// ─── Platform Settings ──────────────────────────────────────────────
export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(platformSettings).where(eq(platformSettings.settingKey, key)).limit(1);
  return result.length > 0 ? result[0].settingValue : null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(platformSettings).values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(platformSettings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.settingKey] = row.settingValue ?? "";
  }
  return result;
}

export async function bulkSetSettings(settings: Record<string, string>) {
  const db = await getDb();
  if (!db) return;
  for (const [key, value] of Object.entries(settings)) {
    await db.insert(platformSettings).values({ settingKey: key, settingValue: value })
      .onDuplicateKeyUpdate({ set: { settingValue: value } });
  }
}

// ─── Local Auth ─────────────────────────────────────────────────────
export async function getUserByUserId(userId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  userId: string;
  passwordHash: string;
  displayName: string;
  name?: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  role?: "user" | "admin" | "landlord" | "tenant";
}) {
  const db = await getDb();
  if (!db) return null;
  const openId = `local_${data.userId}`;
  const result = await db.insert(users).values({
    openId,
    userId: data.userId,
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    name: data.name || data.displayName,
    nameAr: data.nameAr,
    email: data.email,
    phone: data.phone,
    role: data.role || "user",
    loginMethod: "local",
  });
  return result[0].insertId;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// ─── AI Conversations ──────────────────────────────────────────────
export async function createAiConversation(userId: number, title?: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiConversations).values({ userId, title: title || "محادثة جديدة" });
  return result[0].insertId;
}

export async function getAiConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt));
}

export async function getAiConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteAiConversation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
  await db.delete(aiConversations).where(eq(aiConversations.id, id));
}

// ─── AI Messages ───────────────────────────────────────────────────
export async function createAiMessage(data: { conversationId: number; role: "user" | "assistant"; content: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiMessages).values(data);
  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, data.conversationId));
  return result[0].insertId;
}

export async function getAiMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
}

export async function rateAiMessage(id: number, rating: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiMessages).set({ rating }).where(eq(aiMessages.id, id));
}

// ─── Knowledge Base ────────────────────────────────────────────────
export async function createKnowledgeArticle(data: InsertKnowledgeBase) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(knowledgeBase).values(data);
  return result[0].insertId;
}

export async function getKnowledgeArticles(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(knowledgeBase)
      .where(and(eq(knowledgeBase.category, category as any), eq(knowledgeBase.isActive, true)))
      .orderBy(desc(knowledgeBase.updatedAt));
  }
  return db.select().from(knowledgeBase)
    .where(eq(knowledgeBase.isActive, true))
    .orderBy(desc(knowledgeBase.updatedAt));
}

export async function getAllKnowledgeArticles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.updatedAt));
}

export async function updateKnowledgeArticle(id: number, data: Partial<InsertKnowledgeBase>) {
  const db = await getDb();
  if (!db) return;
  await db.update(knowledgeBase).set(data).where(eq(knowledgeBase.id, id));
}

export async function deleteKnowledgeArticle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}

export async function searchKnowledgeBase(query: string) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  return db.select().from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.isActive, true),
      or(
        like(knowledgeBase.titleEn, q),
        like(knowledgeBase.titleAr, q),
        like(knowledgeBase.contentEn, q),
        like(knowledgeBase.contentAr, q),
      )
    ));
}


// ─── User Activity Tracking ─────────────────────────────────────────
export async function trackActivity(data: InsertUserActivity) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivities).values(data);
}

export async function getActivityLog(filters?: { userId?: number; action?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.userId) conditions.push(eq(userActivities.userId, filters.userId));
  if (filters?.action) conditions.push(eq(userActivities.action, filters.action));
  const query = db.select().from(userActivities).orderBy(desc(userActivities.createdAt));
  if (conditions.length > 0) query.where(and(...conditions));
  if (filters?.limit) query.limit(filters.limit);
  if (filters?.offset) query.offset(filters.offset);
  return query;
}

export async function getActivityStats() {
  const db = await getDb();
  if (!db) return { totalActions: 0, uniqueUsers: 0, topActions: [], recentActivity: [] };
  
  const totalActions = await db.select({ count: sql<number>`COUNT(*)` }).from(userActivities);
  const uniqueUsers = await db.select({ count: sql<number>`COUNT(DISTINCT userId)` }).from(userActivities);
  const topActions = await db.select({
    action: userActivities.action,
    count: sql<number>`COUNT(*) as cnt`,
  }).from(userActivities).groupBy(userActivities.action).orderBy(sql`cnt DESC`).limit(10);
  
  const recentActivity = await db.select().from(userActivities).orderBy(desc(userActivities.createdAt)).limit(20);
  
  return {
    totalActions: totalActions[0]?.count ?? 0,
    uniqueUsers: uniqueUsers[0]?.count ?? 0,
    topActions,
    recentActivity,
  };
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return { searches: [], viewedProperties: [], favoriteTypes: [] };
  
  const searches = await db.select({ metadata: userActivities.metadata })
    .from(userActivities)
    .where(and(eq(userActivities.userId, userId), eq(userActivities.action, "search")))
    .orderBy(desc(userActivities.createdAt)).limit(20);
  
  const viewedProperties = await db.select({ metadata: userActivities.metadata })
    .from(userActivities)
    .where(and(eq(userActivities.userId, userId), eq(userActivities.action, "property_view")))
    .orderBy(desc(userActivities.createdAt)).limit(20);
  
  return { searches, viewedProperties, favoriteTypes: [] };
}

// ─── Admin Permissions ──────────────────────────────────────────────
export async function getAdminPermissions(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(adminPermissions).where(eq(adminPermissions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function setAdminPermissions(userId: number, perms: string[], isRoot = false) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminPermissions).values({ userId, permissions: perms, isRootAdmin: isRoot })
    .onDuplicateKeyUpdate({ set: { permissions: perms } });
}

export async function getAllAdminPermissions() {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  const perms = await db.select().from(adminPermissions);
  const permsMap = new Map(perms.map(p => [p.userId, p]));
  return admins.map(a => ({
    ...a,
    permissions: permsMap.get(a.id)?.permissions ?? [],
    isRootAdmin: permsMap.get(a.id)?.isRootAdmin ?? false,
  }));
}

export async function deleteAdminPermissions(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adminPermissions).where(eq(adminPermissions.userId, userId));
}

// ─── Cities ────────────────────────────────────────────────────────
export async function getAllCities(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(cities).where(eq(cities.isActive, true)).orderBy(cities.sortOrder, cities.nameEn);
  }
  return db.select().from(cities).orderBy(cities.sortOrder, cities.nameEn);
}

export async function getCityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cities).where(eq(cities.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createCity(data: InsertCity) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(cities).values(data);
  return result[0].insertId;
}

export async function updateCity(id: number, data: Partial<InsertCity>) {
  const db = await getDb();
  if (!db) return;
  await db.update(cities).set(data).where(eq(cities.id, id));
}

export async function deleteCity(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cities).where(eq(cities.id, id));
}

export async function toggleCityActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(cities).set({ isActive }).where(eq(cities.id, id));
}

export async function getCityCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(cities);
  return result[0]?.count ?? 0;
}

// ─── Districts ──────────────────────────────────────────────────────
export async function getAllDistricts(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(eq(districts.isActive, true)).orderBy(districts.city, districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).orderBy(districts.city, districts.sortOrder, districts.nameEn);
}

export async function getDistrictsByCity(city: string, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(and(eq(districts.city, city), eq(districts.isActive, true))).orderBy(districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).where(eq(districts.city, city)).orderBy(districts.sortOrder, districts.nameEn);
}

export async function getDistrictsByCityId(cityId: number, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(and(eq(districts.cityId, cityId), eq(districts.isActive, true))).orderBy(districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).where(eq(districts.cityId, cityId)).orderBy(districts.sortOrder, districts.nameEn);
}

export async function getDistrictById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(districts).where(eq(districts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createDistrict(data: InsertDistrict) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(districts).values(data);
  return result[0].insertId;
}

export async function updateDistrict(id: number, data: Partial<InsertDistrict>) {
  const db = await getDb();
  if (!db) return;
  await db.update(districts).set(data).where(eq(districts.id, id));
}

export async function deleteDistrict(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(districts).where(eq(districts.id, id));
}

export async function toggleDistrictActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(districts).set({ isActive }).where(eq(districts.id, id));
}

export async function bulkCreateDistricts(data: InsertDistrict[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < data.length; i += 50) {
    const batch = data.slice(i, i + 50);
    await db.insert(districts).values(batch);
  }
}

export async function deleteDistrictsByCity(city: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(districts).where(eq(districts.city, city));
}

export async function getDistrictCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(districts);
  return result[0]?.count ?? 0;
}
