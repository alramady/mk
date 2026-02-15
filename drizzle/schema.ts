import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  userId: varchar("userId", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  displayName: varchar("displayName", { length: 100 }),
  name: text("name"),
  nameAr: text("nameAr"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "landlord", "tenant"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  bioAr: text("bioAr"),
  preferredLang: mysqlEnum("preferredLang", ["ar", "en"]).default("ar"),
  isVerified: boolean("isVerified").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Properties ──────────────────────────────────────────────────────
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  propertyType: mysqlEnum("propertyType", [
    "apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"
  ]).notNull(),
  status: mysqlEnum("status", ["draft", "pending", "active", "inactive", "rejected"]).default("draft").notNull(),
  // Location
  city: varchar("city", { length: 100 }),
  cityAr: varchar("cityAr", { length: 100 }),
  district: varchar("district", { length: 100 }),
  districtAr: varchar("districtAr", { length: 100 }),
  address: text("address"),
  addressAr: text("addressAr"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  // Details
  bedrooms: int("bedrooms").default(1),
  bathrooms: int("bathrooms").default(1),
  sizeSqm: int("sizeSqm"),
  floor: int("floor"),
  totalFloors: int("totalFloors"),
  yearBuilt: int("yearBuilt"),
  furnishedLevel: mysqlEnum("furnishedLevel", ["unfurnished", "semi_furnished", "fully_furnished"]).default("unfurnished"),
  // Pricing
  monthlyRent: decimal("monthlyRent", { precision: 10, scale: 2 }).notNull(),
  securityDeposit: decimal("securityDeposit", { precision: 10, scale: 2 }),
  // Amenities stored as JSON array
  amenities: json("amenities").$type<string[]>(),
  // Utilities included
  utilitiesIncluded: json("utilitiesIncluded").$type<string[]>(),
  // Rules
  houseRules: text("houseRules"),
  houseRulesAr: text("houseRulesAr"),
  // Booking settings
  minStayMonths: int("minStayMonths").default(1),
  maxStayMonths: int("maxStayMonths").default(12),
  instantBook: boolean("instantBook").default(false),
  // Media
  photos: json("photos").$type<string[]>(),
  videoUrl: text("videoUrl"),
  virtualTourUrl: text("virtualTourUrl"),
  // Flags
  isVerified: boolean("isVerified").default(false),
  isFeatured: boolean("isFeatured").default(false),
  viewCount: int("viewCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ─── Property Availability ──────────────────────────────────────────
export const propertyAvailability = mysqlTable("propertyAvailability", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isBlocked: boolean("isBlocked").default(false),
  priceOverride: decimal("priceOverride", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Favorites ───────────────────────────────────────────────────────
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyId: int("propertyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bookings ────────────────────────────────────────────────────────
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  tenantId: int("tenantId").notNull(),
  landlordId: int("landlordId").notNull(),
  status: mysqlEnum("status", [
    "pending", "approved", "rejected", "active", "completed", "cancelled"
  ]).default("pending").notNull(),
  moveInDate: timestamp("moveInDate").notNull(),
  moveOutDate: timestamp("moveOutDate").notNull(),
  durationMonths: int("durationMonths").notNull(),
  monthlyRent: decimal("monthlyRent", { precision: 10, scale: 2 }).notNull(),
  securityDeposit: decimal("securityDeposit", { precision: 10, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  // Lease
  leaseTerms: text("leaseTerms"),
  leaseTermsAr: text("leaseTermsAr"),
  contractUrl: text("contractUrl"),
  // Notes
  tenantNotes: text("tenantNotes"),
  landlordNotes: text("landlordNotes"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Payments ────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  tenantId: int("tenantId").notNull(),
  landlordId: int("landlordId").notNull(),
  type: mysqlEnum("type", ["rent", "deposit", "service_fee", "refund"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "refunded"]).default("pending").notNull(),
  stripePaymentId: varchar("stripePaymentId", { length: 255 }),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  paypalOrderId: varchar("paypalOrderId", { length: 255 }),
  paypalCaptureId: varchar("paypalCaptureId", { length: 255 }),
  payerEmail: varchar("payerEmail", { length: 255 }),
  paymentMethod: mysqlEnum("paymentMethod", ["paypal", "cash", "bank_transfer"]).default("cash"),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ─── Messages ────────────────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId"),
  tenantId: int("tenantId").notNull(),
  landlordId: int("landlordId").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "file"]).default("text"),
  fileUrl: text("fileUrl"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Maintenance Requests ────────────────────────────────────────────
export const maintenanceRequests = mysqlTable("maintenanceRequests", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  tenantId: int("tenantId").notNull(),
  landlordId: int("landlordId").notNull(),
  bookingId: int("bookingId"),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  description: text("description").notNull(),
  descriptionAr: text("descriptionAr"),
  category: mysqlEnum("category", [
    "plumbing", "electrical", "hvac", "appliance", "structural", "pest_control", "cleaning", "other"
  ]).default("other"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "emergency"]).default("medium"),
  status: mysqlEnum("status", ["submitted", "acknowledged", "in_progress", "completed", "cancelled"]).default("submitted").notNull(),
  photos: json("photos").$type<string[]>(),
  landlordResponse: text("landlordResponse"),
  landlordResponseAr: text("landlordResponseAr"),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type InsertMaintenanceRequest = typeof maintenanceRequests.$inferInsert;

// ─── Reviews ─────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  tenantId: int("tenantId").notNull(),
  bookingId: int("bookingId"),
  rating: int("rating").notNull(),
  comment: text("comment"),
  commentAr: text("commentAr"),
  isPublished: boolean("isPublished").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Notifications ───────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "booking_request", "booking_approved", "booking_rejected",
    "payment_received", "payment_due", "message_new",
    "maintenance_update", "lease_expiring", "system"
  ]).notNull(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  contentEn: text("contentEn"),
  contentAr: text("contentAr"),
  relatedId: int("relatedId"),
  relatedType: varchar("relatedType", { length: 50 }),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Saved Searches ──────────────────────────────────────────────────
export const savedSearches = mysqlTable("savedSearches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }),
  filters: json("filters").$type<Record<string, unknown>>(),
  alertEnabled: boolean("alertEnabled").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Platform Settings ──────────────────────────────────────────────
export const platformSettings = mysqlTable("platformSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── AI Chat ────────────────────────────────────────────────────────
export const aiConversations = mysqlTable("aiConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiMessages = mysqlTable("aiMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  rating: int("rating"), // 1-5 stars
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;

// ─── Knowledge Base ─────────────────────────────────────────────────
export const knowledgeBase = mysqlTable("knowledgeBase", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", [
    "general", "tenant_guide", "landlord_guide", "admin_guide",
    "faq", "policy", "troubleshooting"
  ]).default("general").notNull(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  contentEn: text("contentEn").notNull(),
  contentAr: text("contentAr").notNull(),
  tags: json("tags").$type<string[]>(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;


// ─── User Activity Tracking ─────────────────────────────────────────
export const userActivities = mysqlTable("userActivities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 50 }).notNull(), // page_view, search, favorite, booking, login, register, property_view, message_sent
  page: varchar("page", { length: 255 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  sessionId: varchar("sessionId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = typeof userActivities.$inferInsert;

// ─── Admin Permissions ──────────────────────────────────────────────
export const adminPermissions = mysqlTable("adminPermissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  isRootAdmin: boolean("isRootAdmin").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = typeof adminPermissions.$inferInsert;

// ─── Saudi Cities ──────────────────────────────────────────────────
export const cities = mysqlTable("cities", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }).notNull(),
  region: varchar("region", { length: 100 }),
  regionAr: varchar("regionAr", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type City = typeof cities.$inferSelect;
export type InsertCity = typeof cities.$inferInsert;

// ─── Saudi Districts ────────────────────────────────────────────────
export const districts = mysqlTable("districts", {
  id: int("id").autoincrement().primaryKey(),
  cityId: int("cityId"),
  city: varchar("city", { length: 100 }).notNull(),
  cityAr: varchar("cityAr", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type District = typeof districts.$inferSelect;
export type InsertDistrict = typeof districts.$inferInsert;
