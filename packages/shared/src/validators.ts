import { z } from "zod";

export const brandSchema = z.enum(["COBNB", "MONTHLYKEY"]);
export const operationModeSchema = z.enum(["standalone", "integrated"]);

export const searchParamsSchema = z.object({
  brand: brandSchema,
  city: z.string().optional(),
  zone: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  guests: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const quoteParamsSchema = z.object({
  brand: brandSchema,
  unitId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).optional(),
});

/**
 * Booking create schema.
 * NOTE: idempotencyKey is extracted from the Idempotency-Key HTTP header
 * by the route handler and injected here — it is NOT in the request body.
 */
export const bookingCreateSchema = z.object({
  brand: brandSchema,
  unitId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName: z.string().min(2).max(200),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(8).max(20),
  guests: z.coerce.number().int().min(1),
  paymentMethod: z.enum(["CARD", "BANK_TRANSFER", "CASH"]),
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const ticketCreateSchema = z.object({
  type: z.enum(["CLEANING", "MAINTENANCE", "INSPECTION", "GUEST_ISSUE"]),
  unitId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  title: z.string().min(3).max(300),
  description: z.string().max(5000).default(""),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToUserId: z.string().uuid().optional(),
  zone: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const ticketStatusUpdateSchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  notes: z.string().max(5000).optional(),
});

export const ticketAssignSchema = z.object({
  assignedToUserId: z.string().uuid(),
});

export const featureFlagUpdateSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  scope: z.enum(["GLOBAL", "COBNB", "MONTHLYKEY", "OPS"]).default("GLOBAL"),
  description: z.string().max(500).optional(),
});

export const beds24ProxySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  path: z.string().startsWith("/api/v2/"),
  query: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Location resolve request */
export const locationResolveSchema = z.object({
  google_maps_url: z.string().min(10).max(2000).url(),
  unit_number: z.string().max(50).nullable().optional(),
  address_notes: z.string().max(1000).nullable().optional(),
});

/** Webhook event from Beds24 */
export const webhookEventSchema = z.object({
  id: z.string().or(z.number()).transform(String),
  type: z.string(),
  bookingId: z.string().or(z.number()).transform(String).optional(),
  propertyId: z.string().or(z.number()).transform(String).optional(),
  roomId: z.string().or(z.number()).transform(String).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  timestamp: z.string().optional(),
});
