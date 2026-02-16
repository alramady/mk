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
  propertyManagers, InsertPropertyManager,
  propertyManagerAssignments,
  inspectionRequests, InsertInspectionRequest,
  contactMessages, InsertContactMessage,
  platformServices, InsertPlatformService,
  serviceRequests, InsertServiceRequest,
  emergencyMaintenance, InsertEmergencyMaintenance,
  maintenanceUpdates, InsertMaintenanceUpdate,
  aiDocuments, InsertAiDocument,
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
  // Batch load manager info (eliminates N+1 queries)
  const itemIds = items.map(i => i.id);
  let managerMap = new Map<number, { name: string; nameAr: string | null; photoUrl: string | null }>();
  if (itemIds.length > 0) {
    const assignments = await db.select().from(propertyManagerAssignments)
      .where(inArray(propertyManagerAssignments.propertyId, itemIds));
    const managerIds = Array.from(new Set(assignments.map(a => a.managerId)));
    if (managerIds.length > 0) {
      const managers = await db.select().from(propertyManagers)
        .where(inArray(propertyManagers.id, managerIds));
      const mgrById = new Map(managers.map(m => [m.id, m]));
      for (const a of assignments) {
        const mgr = mgrById.get(a.managerId);
        if (mgr) managerMap.set(a.propertyId, { name: mgr.name, nameAr: mgr.nameAr, photoUrl: mgr.photoUrl });
      }
    }
  }
  const itemsWithManager = items.map(item => {
    const mgr = managerMap.get(item.id);
    return mgr ? { ...item, managerName: mgr.name, managerNameAr: mgr.nameAr, managerPhotoUrl: mgr.photoUrl } : item;
  });
  return { items: itemsWithManager, total: countResult[0]?.count ?? 0 };
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
  return db.select({
    id: reviews.id,
    propertyId: reviews.propertyId,
    tenantId: reviews.tenantId,
    bookingId: reviews.bookingId,
    rating: reviews.rating,
    comment: reviews.comment,
    commentAr: reviews.commentAr,
    isPublished: reviews.isPublished,
    createdAt: reviews.createdAt,
    tenantName: users.name,
    tenantNameAr: users.nameAr,
    tenantAvatar: users.avatarUrl,
  })
    .from(reviews)
    .leftJoin(users, eq(reviews.tenantId, users.id))
    .where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true)))
    .orderBy(desc(reviews.createdAt));
}

export async function getReviewsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.tenantId, tenantId)).orderBy(desc(reviews.createdAt));
}

export async function getAllReviews(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id,
    propertyId: reviews.propertyId,
    tenantId: reviews.tenantId,
    bookingId: reviews.bookingId,
    rating: reviews.rating,
    comment: reviews.comment,
    commentAr: reviews.commentAr,
    isPublished: reviews.isPublished,
    createdAt: reviews.createdAt,
    tenantName: users.name,
    tenantNameAr: users.nameAr,
    propertyTitle: properties.titleEn,
    propertyTitleAr: properties.titleAr,
  })
    .from(reviews)
    .leftJoin(users, eq(reviews.tenantId, users.id))
    .leftJoin(properties, eq(reviews.propertyId, properties.id))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateReviewPublished(id: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews).set({ isPublished }).where(eq(reviews.id, id));
}

export async function deleteReview(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reviews).where(eq(reviews.id, id));
}

export async function getPropertyAverageRating(propertyId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const result = await db.select({
    average: sql<number>`COALESCE(AVG(rating), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(reviews)
    .where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true)));
  return { average: Number(result[0]?.average ?? 0), count: Number(result[0]?.count ?? 0) };
}

export async function getAverageRating(propertyId: number) {
  const { average } = await getPropertyAverageRating(propertyId);
  return average;
}

export async function hasUserReviewedBooking(tenantId: number, bookingId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ count: sql<number>`count(*)` }).from(reviews)
    .where(and(eq(reviews.tenantId, tenantId), eq(reviews.bookingId, bookingId)));
  return (result[0]?.count ?? 0) > 0;
}

export async function getReviewCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(reviews);
  return result[0]?.count ?? 0;
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


// ─── PayPal Payment Helpers ──────────────────────────────────────────
export async function updateBookingPayment(bookingId: number, data: {
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paymentStatus?: string;
  payerEmail?: string;
  paidAmount?: string;
}) {
  const db = await getDb();
  if (!db) return;
  // Update or create payment record
  const existing = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
  if (existing.length > 0) {
    await db.update(payments).set({
      paypalOrderId: data.paypalOrderId || existing[0].paypalOrderId,
      paypalCaptureId: data.paypalCaptureId || existing[0].paypalCaptureId,
      payerEmail: data.payerEmail || existing[0].payerEmail,
      status: data.paymentStatus === "paid" ? "completed" : data.paymentStatus === "pending" ? "pending" : existing[0].status,
      paymentMethod: "paypal",
      paidAt: data.paymentStatus === "paid" ? new Date() : existing[0].paidAt,
    }).where(eq(payments.id, existing[0].id));
  } else {
    // Get booking details to create payment
    const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (booking.length > 0) {
      await db.insert(payments).values({
        bookingId,
        tenantId: booking[0].tenantId,
        landlordId: booking[0].landlordId,
        type: "rent",
        amount: data.paidAmount || booking[0].totalAmount || "0",
        currency: "SAR",
        status: data.paymentStatus === "paid" ? "completed" : "pending",
        paypalOrderId: data.paypalOrderId,
        paypalCaptureId: data.paypalCaptureId,
        payerEmail: data.payerEmail,
        paymentMethod: "paypal",
        paidAt: data.paymentStatus === "paid" ? new Date() : null,
      });
    }
  }
}

// ─── Property Managers ─────────────────────────────────────────────
export async function getAllPropertyManagers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(propertyManagers).where(eq(propertyManagers.isActive, true));
}

export async function getPropertyManagerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.id, id)).limit(1);
  return result[0] || null;
}

export async function getPropertyManagerByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return null;
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.propertyId, propertyId))
    .limit(1);
  if (assignments.length === 0) return null;
  return await getPropertyManagerById(assignments[0].managerId);
}

export async function createPropertyManager(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(propertyManagers).values(data);
  return result[0].insertId;
}

export async function updatePropertyManager(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertyManagers).set(data).where(eq(propertyManagers.id, id));
}

export async function deletePropertyManager(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertyManagers).set({ isActive: false }).where(eq(propertyManagers.id, id));
  await db.delete(propertyManagerAssignments).where(eq(propertyManagerAssignments.managerId, id));
}

export async function assignManagerToProperties(managerId: number, propertyIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(propertyManagerAssignments).where(eq(propertyManagerAssignments.managerId, managerId));
  if (propertyIds.length > 0) {
    await db.insert(propertyManagerAssignments).values(
      propertyIds.map(propertyId => ({ managerId, propertyId }))
    );
  }
}

export async function getManagerAssignments(managerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.managerId, managerId));
}

export async function getManagerByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.editToken, token)).limit(1);
  return result[0] || null;
}

export async function getManagerByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.email, email)).limit(1);
  return result[0] || null;
}

export async function setManagerEditToken(managerId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertyManagers).set({ editToken: token }).where(eq(propertyManagers.id, managerId));
}

export async function getManagerWithProperties(managerId: number) {
  const db = await getDb();
  if (!db) return null;
  const manager = await getPropertyManagerById(managerId);
  if (!manager) return null;
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.managerId, managerId));
  const propertyIds = assignments.map(a => a.propertyId);
  let assignedProperties: any[] = [];
  if (propertyIds.length > 0) {
    assignedProperties = await db.select().from(properties)
      .where(and(inArray(properties.id, propertyIds), eq(properties.status, 'active')));
  }
  return { ...manager, properties: assignedProperties, propertyCount: assignedProperties.length };
}

export async function getAllManagersWithCounts() {
  const db = await getDb();
  if (!db) return [];
  const managers = await db.select().from(propertyManagers);
  const allAssignments = await db.select().from(propertyManagerAssignments);
  // Get property titles for display
  const propIds = Array.from(new Set(allAssignments.map(a => a.propertyId)));
  let propMap = new Map<number, string>();
  if (propIds.length > 0) {
    const props = await db.select({ id: properties.id, titleEn: properties.titleEn }).from(properties).where(inArray(properties.id, propIds));
    propMap = new Map(props.map(p => [p.id, p.titleEn]));
  }
  return managers.map(m => {
    const mAssignments = allAssignments.filter(a => a.managerId === m.id);
    return {
      ...m,
      propertyCount: mAssignments.length,
      assignedProperties: mAssignments.map(a => ({ propertyId: a.propertyId, propertyTitle: propMap.get(a.propertyId) || '' })),
    };
  });
}

export async function getPropertyManagersForProperties(propertyIds: number[]) {
  const db = await getDb();
  if (!db) return new Map<number, any>();
  if (propertyIds.length === 0) return new Map<number, any>();
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(inArray(propertyManagerAssignments.propertyId, propertyIds));
  const managerIds = Array.from(new Set(assignments.map(a => a.managerId)));
  if (managerIds.length === 0) return new Map<number, any>();
  const managers = await db.select().from(propertyManagers)
    .where(inArray(propertyManagers.id, managerIds));
  const managerMap = new Map(managers.map(m => [m.id, m]));
  const result = new Map<number, any>();
  for (const a of assignments) {
    const mgr = managerMap.get(a.managerId);
    if (mgr) result.set(a.propertyId, mgr);
  }
  return result;
}

// ─── Inspection Requests ───────────────────────────────────────────
export async function createInspectionRequest(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(inspectionRequests).values(data);
  return result[0].insertId;
}

export async function getUserInspectionRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionRequests)
    .where(eq(inspectionRequests.userId, userId))
    .orderBy(desc(inspectionRequests.createdAt));
}

export async function getAllInspectionRequests(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db.select().from(inspectionRequests)
      .where(eq(inspectionRequests.status, status as any))
      .orderBy(desc(inspectionRequests.createdAt));
  }
  return await db.select().from(inspectionRequests)
    .orderBy(desc(inspectionRequests.createdAt));
}

export async function updateInspectionStatus(id: number, status: string, adminNotes?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (adminNotes) updateData.adminNotes = adminNotes;
  if (status === "confirmed") updateData.confirmedAt = new Date();
  if (status === "completed") updateData.completedAt = new Date();
  await db.update(inspectionRequests).set(updateData).where(eq(inspectionRequests.id, id));
}

// ─── Contact Messages ───────────────────────────────────────────────
export async function createContactMessage(data: InsertContactMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(contactMessages).values(data as any);
  return result[0].insertId;
}

export async function getContactMessages(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db.select().from(contactMessages)
      .where(eq(contactMessages.status, status as any))
      .orderBy(desc(contactMessages.createdAt));
  }
  return await db.select().from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));
}

export async function updateContactMessageStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(contactMessages).set({ status: status as any }).where(eq(contactMessages.id, id));
}

// ─── Platform Services ──────────────────────────────────────────────
export async function createPlatformService(data: InsertPlatformService) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(platformServices).values(data).$returningId();
  return result;
}

export async function updatePlatformService(id: number, data: Partial<InsertPlatformService>) {
  const db = await getDb();
  if (!db) return;
  await db.update(platformServices).set(data).where(eq(platformServices.id, id));
}

export async function deletePlatformService(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(platformServices).where(eq(platformServices.id, id));
}

export async function getAllPlatformServices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(platformServices).orderBy(platformServices.sortOrder);
}

export async function getActivePlatformServices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(platformServices)
    .where(eq(platformServices.isActive, true))
    .orderBy(platformServices.sortOrder);
}

// ─── Service Requests ───────────────────────────────────────────────
export async function createServiceRequest(data: InsertServiceRequest) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(serviceRequests).values(data).$returningId();
  return result;
}

export async function getServiceRequestsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceRequests)
    .where(eq(serviceRequests.tenantId, tenantId))
    .orderBy(desc(serviceRequests.createdAt));
}

export async function getAllServiceRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceRequests)
    .orderBy(desc(serviceRequests.createdAt));
}

export async function updateServiceRequest(id: number, data: Partial<InsertServiceRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(serviceRequests).set(data).where(eq(serviceRequests.id, id));
}

// ─── Emergency Maintenance ──────────────────────────────────────────
export async function createEmergencyMaintenance(data: InsertEmergencyMaintenance) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(emergencyMaintenance).values(data).$returningId();
  return result;
}

export async function getEmergencyMaintenanceByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emergencyMaintenance)
    .where(eq(emergencyMaintenance.tenantId, tenantId))
    .orderBy(desc(emergencyMaintenance.createdAt));
}

export async function getAllEmergencyMaintenance() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emergencyMaintenance)
    .orderBy(desc(emergencyMaintenance.createdAt));
}

export async function getEmergencyMaintenanceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(emergencyMaintenance)
    .where(eq(emergencyMaintenance.id, id));
  return result || null;
}

export async function updateEmergencyMaintenance(id: number, data: Partial<InsertEmergencyMaintenance>) {
  const db = await getDb();
  if (!db) return;
  await db.update(emergencyMaintenance).set(data).where(eq(emergencyMaintenance.id, id));
}

// ─── Maintenance Updates ────────────────────────────────────────────
export async function createMaintenanceUpdate(data: InsertMaintenanceUpdate) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(maintenanceUpdates).values(data).$returningId();
  return result;
}

export async function getMaintenanceUpdates(maintenanceId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(maintenanceUpdates)
    .where(eq(maintenanceUpdates.maintenanceId, maintenanceId))
    .orderBy(maintenanceUpdates.createdAt);
}


// ─── Analytics ──────────────────────────────────────────────────────

/** Monthly booking counts for the last N months */
export async function getBookingsByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COUNT(*) AS count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeCount,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingCount
    FROM bookings
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** Monthly revenue for the last N months */
export async function getRevenueByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS revenue,
      COUNT(*) AS transactionCount
    FROM payments
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** User registration counts by month */
export async function getUserRegistrationsByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COUNT(*) AS count,
      SUM(CASE WHEN role = 'tenant' THEN 1 ELSE 0 END) AS tenantCount,
      SUM(CASE WHEN role = 'landlord' THEN 1 ELSE 0 END) AS landlordCount
    FROM users
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** Property listings by type */
export async function getPropertiesByType() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT propertyType, COUNT(*) AS count
    FROM properties
    WHERE status = 'active'
    GROUP BY propertyType
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Property listings by city */
export async function getPropertiesByCity() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT city, cityAr, COUNT(*) AS count
    FROM properties
    WHERE status = 'active'
    GROUP BY city, cityAr
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Booking status distribution */
export async function getBookingStatusDistribution() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT status, COUNT(*) AS count
    FROM bookings
    GROUP BY status
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Revenue by payment method */
export async function getRevenueByPaymentMethod() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT paymentMethod, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM payments
    WHERE status = 'completed'
    GROUP BY paymentMethod
    ORDER BY total DESC
  `);
  return (result as any)[0] ?? [];
}

/** Top performing properties by revenue */
export async function getTopProperties(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      p.id, p.titleEn, p.titleAr, p.city, p.cityAr, p.monthlyRent,
      COUNT(b.id) AS bookingCount,
      COALESCE(SUM(b.totalAmount), 0) AS totalRevenue,
      p.viewCount
    FROM properties p
    LEFT JOIN bookings b ON b.propertyId = p.id AND b.status IN ('active', 'completed')
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY totalRevenue DESC
    LIMIT ${limit}
  `);
  return (result as any)[0] ?? [];
}

/** Service requests summary */
export async function getServiceRequestsSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      sr.status,
      COUNT(*) AS count,
      COALESCE(SUM(sr.totalPrice), 0) AS totalValue
    FROM service_requests sr
    GROUP BY sr.status
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Emergency maintenance summary */
export async function getMaintenanceSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      status, urgency, COUNT(*) AS count
    FROM emergency_maintenance
    GROUP BY status, urgency
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Occupancy rate: active bookings / active properties */
export async function getOccupancyRate() {
  const db = await getDb();
  if (!db) return { occupancyRate: 0, activeBookings: 0, activeProperties: 0 };
  const [bookingResult] = await db.select({ count: sql<number>`count(*)` }).from(bookings)
    .where(eq(bookings.status, "active"));
  const [propertyResult] = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(eq(properties.status, "active"));
  const activeBookingsCount = bookingResult?.count ?? 0;
  const activePropertiesCount = propertyResult?.count ?? 0;
  const rate = activePropertiesCount > 0 ? Math.round((activeBookingsCount / activePropertiesCount) * 100) : 0;
  return { occupancyRate: rate, activeBookings: activeBookingsCount, activeProperties: activePropertiesCount };
}

/** Recent activity feed */
export async function getRecentActivity(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    (SELECT 'booking' AS type, id, status AS detail, createdAt FROM bookings ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'payment' AS type, id, status AS detail, createdAt FROM payments ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'user' AS type, id, role AS detail, createdAt FROM users ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'property' AS type, id, status AS detail, createdAt FROM properties ORDER BY createdAt DESC LIMIT 5)
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);
  return (result as any)[0] ?? [];
}




// ─── Featured Cities ────────────────────────────────────────────
export async function getFeaturedCities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cities)
    .where(and(eq(cities.isFeatured, true), eq(cities.isActive, true)))
    .orderBy(asc(cities.sortOrder));
}


// ─── AI Documents ─────────────────────────────────────────────────
export async function createAiDocument(data: InsertAiDocument) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiDocuments).values(data);
  return result[0].insertId;
}

export async function getAiDocuments(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(aiDocuments).where(eq(aiDocuments.isActive, true)).orderBy(desc(aiDocuments.createdAt));
  }
  return db.select().from(aiDocuments).orderBy(desc(aiDocuments.createdAt));
}

export async function getAiDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiDocuments).where(eq(aiDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAiDocument(id: number, data: Partial<InsertAiDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiDocuments).set(data).where(eq(aiDocuments.id, id));
}

export async function deleteAiDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(aiDocuments).where(eq(aiDocuments.id, id));
}

// ─── AI Admin Stats ───────────────────────────────────────────────
export async function getAiStats() {
  const db = await getDb();
  if (!db) return { totalConversations: 0, totalMessages: 0, avgRating: 0, totalDocuments: 0, totalArticles: 0 };
  
  const [convCount] = await db.select({ count: sql<number>`count(*)` }).from(aiConversations);
  const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(aiMessages);
  const [avgRat] = await db.select({ avg: sql<number>`COALESCE(AVG(rating), 0)` }).from(aiMessages).where(sql`rating IS NOT NULL`);
  const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(aiDocuments);
  const [artCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeBase);
  
  return {
    totalConversations: convCount.count,
    totalMessages: msgCount.count,
    avgRating: Number(avgRat.avg) || 0,
    totalDocuments: docCount.count,
    totalArticles: artCount.count,
  };
}

export async function getAllAiConversations(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: aiConversations.id,
    userId: aiConversations.userId,
    title: aiConversations.title,
    createdAt: aiConversations.createdAt,
    updatedAt: aiConversations.updatedAt,
  }).from(aiConversations)
    .orderBy(desc(aiConversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getAiRatedMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: aiMessages.id,
    conversationId: aiMessages.conversationId,
    role: aiMessages.role,
    content: aiMessages.content,
    rating: aiMessages.rating,
    createdAt: aiMessages.createdAt,
  }).from(aiMessages)
    .where(sql`${aiMessages.rating} IS NOT NULL`)
    .orderBy(desc(aiMessages.createdAt))
    .limit(100);
}

export async function getActiveAiDocumentTexts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    filename: aiDocuments.filename,
    extractedText: aiDocuments.extractedText,
    category: aiDocuments.category,
    description: aiDocuments.description,
    descriptionAr: aiDocuments.descriptionAr,
  }).from(aiDocuments)
    .where(and(eq(aiDocuments.isActive, true), sql`${aiDocuments.extractedText} IS NOT NULL`));
}
