import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────
export const brandEnum = pgEnum("brand", ["COBNB", "MONTHLYKEY"]);
export const channelEnum = pgEnum("channel", ["COBNB", "MONTHLYKEY"]);
export const unitStatusEnum = pgEnum("unit_status", ["ACTIVE", "INACTIVE", "MAINTENANCE"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "INITIATED", "PAID", "FAILED", "PENDING_BANK_TRANSFER", "REFUNDED",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["CARD", "BANK_TRANSFER", "CASH"]);
export const ticketTypeEnum = pgEnum("ticket_type", [
  "CLEANING", "MAINTENANCE", "INSPECTION", "GUEST_ISSUE",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const userRoleEnum = pgEnum("user_role", [
  "ADMIN", "OPS_MANAGER", "CLEANER", "TECHNICIAN", "VENDOR", "SUPPORT", "OWNER", "TENANT",
]);
export const featureFlagScopeEnum = pgEnum("feature_flag_scope", [
  "GLOBAL", "COBNB", "MONTHLYKEY", "OPS",
]);

// ─── Units ──────────────────────────────────────────────────
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  beds24PropertyId: varchar("beds24_property_id", { length: 50 }),
  beds24RoomId: varchar("beds24_room_id", { length: 50 }),
  title: varchar("title", { length: 300 }).notNull(),
  titleAr: varchar("title_ar", { length: 300 }).notNull().default(""),
  description: text("description").notNull().default(""),
  descriptionAr: text("description_ar").notNull().default(""),
  city: varchar("city", { length: 100 }).notNull(),
  zone: varchar("zone", { length: 100 }).notNull().default(""),
  address: text("address").notNull().default(""),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  bedrooms: integer("bedrooms").notNull().default(1),
  bathrooms: integer("bathrooms").notNull().default(1),
  maxGuests: integer("max_guests").notNull().default(2),
  areaSqm: integer("area_sqm"),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  channelsEnabled: jsonb("channels_enabled").$type<string[]>().notNull().default([]),
  status: unitStatusEnum("status").notNull().default("ACTIVE"),
  monthlyPrice: integer("monthly_price"),
  dailyPrice: integer("daily_price"),
  currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  cityIdx: index("units_city_idx").on(t.city),
  statusIdx: index("units_status_idx").on(t.status),
  beds24PropIdx: index("units_beds24_prop_idx").on(t.beds24PropertyId),
}));

// ─── Bookings ───────────────────────────────────────────────
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: brandEnum("brand").notNull(),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  beds24BookingId: varchar("beds24_booking_id", { length: 50 }),
  guestName: varchar("guest_name", { length: 300 }).notNull(),
  guestEmail: varchar("guest_email", { length: 300 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 30 }).notNull().default(""),
  checkIn: timestamp("check_in", { withTimezone: true }).notNull(),
  checkOut: timestamp("check_out", { withTimezone: true }).notNull(),
  nights: integer("nights").notNull(),
  total: integer("total").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
  status: bookingStatusEnum("status").notNull().default("PENDING"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("INITIATED"),
  paymentMethod: paymentMethodEnum("payment_method"),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  idempotencyHash: varchar("idempotency_hash", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  brandIdx: index("bookings_brand_idx").on(t.brand),
  unitIdx: index("bookings_unit_idx").on(t.unitId),
  idempotencyIdx: uniqueIndex("bookings_idempotency_idx").on(t.idempotencyKey),
  beds24Idx: index("bookings_beds24_idx").on(t.beds24BookingId),
  checkInIdx: index("bookings_checkin_idx").on(t.checkIn),
}));

// ─── Tickets ────────────────────────────────────────────────
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: ticketTypeEnum("type").notNull(),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description").notNull().default(""),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: ticketPriorityEnum("priority").notNull().default("MEDIUM"),
  status: ticketStatusEnum("status").notNull().default("OPEN"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  zone: varchar("zone", { length: 100 }),
  notes: text("notes"),
  costMaterials: integer("cost_materials").notNull().default(0),
  costLabor: integer("cost_labor").notNull().default(0),
  costVendor: integer("cost_vendor").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  unitIdx: index("tickets_unit_idx").on(t.unitId),
  statusIdx: index("tickets_status_idx").on(t.status),
  typeIdx: index("tickets_type_idx").on(t.type),
  assignedIdx: index("tickets_assigned_idx").on(t.assignedToUserId),
  dueAtIdx: index("tickets_due_at_idx").on(t.dueAt),
}));

// ─── Ticket Tasks ───────────────────────────────────────────
export const ticketTasks = pgTable("ticket_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  done: boolean("done").notNull().default(false),
  photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Users ──────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull().default(""),
  email: varchar("email", { length: 300 }).notNull(),
  passwordHash: varchar("password_hash", { length: 200 }).notNull(),
  role: userRoleEnum("role").notNull().default("TENANT"),
  zones: jsonb("zones").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  roleIdx: index("users_role_idx").on(t.role),
}));

// ─── Feature Flags ──────────────────────────────────────────
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 100 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  scope: featureFlagScopeEnum("scope").notNull().default("GLOBAL"),
  description: text("description").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Audit Log ──────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  action: varchar("action", { length: 200 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
  actorIdx: index("audit_actor_idx").on(t.actorUserId),
  createdIdx: index("audit_created_idx").on(t.createdAt),
}));

// ─── Idempotency Store ──────────────────────────────────────
export const idempotencyStore = pgTable("idempotency_store", {
  key: varchar("key", { length: 100 }).primaryKey(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  responseStatus: integer("response_status").notNull(),
  responseBody: jsonb("response_body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ─── Webhook Events (dedup + retry tracking) ───────────────
export const webhookEventStatusEnum = pgEnum("webhook_event_status", [
  "PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD_LETTER",
]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** External event ID from Beds24 — used for dedup. */
  eventId: varchar("event_id", { length: 200 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  source: varchar("source", { length: 50 }).notNull().default("beds24"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: webhookEventStatusEnum("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(5),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /** UNIQUE on eventId for dedup — reject/skip duplicates. */
  eventIdIdx: uniqueIndex("webhook_events_event_id_idx").on(t.eventId),
  statusIdx: index("webhook_events_status_idx").on(t.status),
  nextRetryIdx: index("webhook_events_next_retry_idx").on(t.nextRetryAt),
}));

// ─── Location Resolve Cache ────────────────────────────────
// Fully additive — no existing tables modified.
// All columns nullable-safe. No backfills required.
export const locationResolveCache = pgTable("location_resolve_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** SHA-256 hash of the final expanded URL — used for dedup/cache lookup. */
  urlHash: varchar("url_hash", { length: 64 }).notNull(),
  /** The original short/compressed URL submitted by the user. */
  originalUrl: text("original_url").notNull(),
  /** The final expanded URL after following redirects. */
  finalUrl: text("final_url").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  formattedAddress: text("formatted_address").notNull().default(""),
  placeId: varchar("place_id", { length: 200 }),
  /** Which provider resolved this: "url_parse" | "google_geocode" | "google_place" */
  resolvedVia: varchar("resolved_via", { length: 50 }).notNull().default("url_parse"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => ({
  urlHashIdx: uniqueIndex("loc_cache_url_hash_idx").on(t.urlHash),
  expiresIdx: index("loc_cache_expires_idx").on(t.expiresAt),
}));

// ─── Proxy Audit Log ───────────────────────────────────────
export const proxyAuditLog = pgTable("proxy_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  query: jsonb("query").$type<Record<string, string>>().default({}),
  /** Request body with PII fields redacted. */
  bodyRedacted: jsonb("body_redacted").default({}),
  responseStatus: integer("response_status").notNull(),
  allowed: boolean("allowed").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorIdx: index("proxy_audit_actor_idx").on(t.actorUserId),
  createdIdx: index("proxy_audit_created_idx").on(t.createdAt),
}));
