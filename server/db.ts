import { eq, and, desc, asc, like, gte, lte, inArray, sql, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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
  propertySubmissions, InsertPropertySubmission, submissionPhotos, InsertSubmissionPhoto,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

let _pool: mysql.Pool | null = null;
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _pool = mysql.createPool(ENV.databaseUrl);
      _db = drizzle(_pool);
      console.log(`[Database] Pool created for environment: ${ENV.appEnvironment}`);
      // Auto-migrate: ensure recoveryEmail column exists
      try {
        await _pool.execute("ALTER TABLE users ADD COLUMN recoveryEmail VARCHAR(320) DEFAULT NULL");
        console.log("[Database] Added missing recoveryEmail column");
      } catch (e: any) {
        if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
          // Column already exists, that's fine
        } else {
          console.warn("[Database] recoveryEmail migration note:", e?.message);
        }
      }
      // Auto-migrate: ensure googleMapsUrl columns exist (migrations 0021/0022 failed to add them)
      const googleMapsUrlFixes = [
        { table: 'properties', sql: "ALTER TABLE `properties` ADD COLUMN `googleMapsUrl` text DEFAULT NULL" },
        { table: 'property_submissions', sql: "ALTER TABLE `property_submissions` ADD COLUMN `googleMapsUrl` text DEFAULT NULL" },
      ];
      for (const fix of googleMapsUrlFixes) {
        try {
          await _pool.execute(fix.sql);
          console.log(`[Database] Added missing googleMapsUrl column to ${fix.table}`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] googleMapsUrl migration note (${fix.table}):`, e?.message);
          }
        }
      }
      // Auto-migrate: ensure bookings table has all required columns (migrations 0017/0020/0024)
      const bookingColumnFixes = [
        // From migration 0020 (property_publish_integrations)
        "ALTER TABLE `bookings` ADD COLUMN `fees` decimal(10,2) DEFAULT 0",
        "ALTER TABLE `bookings` ADD COLUMN `vatAmount` decimal(10,2) DEFAULT 0",
        // From migration 0017 (finance_registry)
        "ALTER TABLE `bookings` ADD COLUMN `beds24BookingId` varchar(100) DEFAULT NULL",
        "ALTER TABLE `bookings` ADD COLUMN `source` enum('BEDS24','LOCAL') DEFAULT 'LOCAL'",
        "ALTER TABLE `bookings` ADD COLUMN `renewalsUsed` int DEFAULT 0",
        "ALTER TABLE `bookings` ADD COLUMN `maxRenewals` int DEFAULT 1",
        "ALTER TABLE `bookings` ADD COLUMN `renewalWindowDays` int DEFAULT 14",
        "ALTER TABLE `bookings` ADD COLUMN `buildingId` int DEFAULT NULL",
        "ALTER TABLE `bookings` ADD COLUMN `unitId` int DEFAULT NULL",
        // From migration 0024 (booking_price_breakdown)
        "ALTER TABLE `bookings` ADD COLUMN `priceBreakdown` json DEFAULT NULL",
      ];
      for (const sql of bookingColumnFixes) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] Bookings migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] Bookings migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure finance tables exist (migration 0017)
      const financeTables = [
        `CREATE TABLE IF NOT EXISTS buildings (
          id int AUTO_INCREMENT PRIMARY KEY,
          name varchar(255) NOT NULL,
          nameAr varchar(255),
          address text,
          city varchar(100),
          totalUnits int DEFAULT 0,
          isArchived boolean NOT NULL DEFAULT false,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS units (
          id int AUTO_INCREMENT PRIMARY KEY,
          buildingId int NOT NULL,
          unitNumber varchar(50) NOT NULL,
          floor int,
          bedrooms int DEFAULT 1,
          bathrooms int DEFAULT 1,
          sizeSqm decimal(10,2),
          monthlyBaseRentSAR decimal(10,2),
          status enum('AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED') NOT NULL DEFAULT 'AVAILABLE',
          beds24PropertyId varchar(100),
          beds24RoomId varchar(100),
          propertyId int DEFAULT NULL,
          isArchived boolean NOT NULL DEFAULT false,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS payment_ledger (
          id int AUTO_INCREMENT PRIMARY KEY,
          invoiceNumber varchar(50) NOT NULL UNIQUE,
          bookingId int,
          beds24BookingId varchar(100),
          customerId int,
          guestName varchar(255),
          guestEmail varchar(320),
          guestPhone varchar(20),
          buildingId int,
          unitId int,
          unitNumber varchar(50),
          propertyDisplayName varchar(255),
          type enum('RENT','RENEWAL_RENT','PROTECTION_FEE','DEPOSIT','CLEANING','PENALTY','REFUND','ADJUSTMENT') NOT NULL,
          direction enum('IN','OUT') NOT NULL DEFAULT 'IN',
          amount decimal(10,2) NOT NULL,
          currency varchar(3) NOT NULL DEFAULT 'SAR',
          status enum('DUE','PENDING','PAID','FAILED','REFUNDED','VOID') NOT NULL DEFAULT 'DUE',
          paymentMethod enum('MADA_CARD','APPLE_PAY','GOOGLE_PAY','TABBY','TAMARA','BANK_TRANSFER','CASH'),
          provider enum('moyasar','tabby','tamara','manual'),
          providerRef varchar(255),
          dueAt timestamp NULL,
          paidAt timestamp NULL,
          createdBy int,
          parentLedgerId int,
          notes text,
          notesAr text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS payment_method_settings (
          id int AUTO_INCREMENT PRIMARY KEY,
          methodKey varchar(50) NOT NULL UNIQUE,
          displayName varchar(100) NOT NULL,
          displayNameAr varchar(100),
          provider varchar(50) NOT NULL,
          isEnabled boolean NOT NULL DEFAULT false,
          apiKeyConfigured boolean NOT NULL DEFAULT false,
          configJson json,
          sortOrder int DEFAULT 0,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
      ];
      for (const sql of financeTables) {
        try {
          await _pool.execute(sql);
        } catch (e: any) {
          // Table already exists or other non-critical error
          if (!e?.message?.includes('already exists')) {
            console.warn(`[Database] Finance table migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure audit_log table exists (migration 0018)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS audit_log (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int,
          userName varchar(255),
          action enum('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND') NOT NULL,
          entityType enum('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE') NOT NULL,
          entityId int NOT NULL,
          entityLabel varchar(255),
          changes json,
          metadata json,
          ipAddress varchar(45),
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_entityType_entityId (entityType, entityId),
          INDEX idx_audit_userId (userId),
          INDEX idx_audit_createdAt (createdAt)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] audit_log table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure property_submissions table exists (migration 0019)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS property_submissions (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          titleEn varchar(255),
          titleAr varchar(255),
          descriptionEn text,
          descriptionAr text,
          propertyType varchar(50) DEFAULT 'apartment',
          city varchar(100),
          cityAr varchar(100),
          district varchar(100),
          districtAr varchar(100),
          address text,
          addressAr text,
          googleMapsUrl text,
          latitude varchar(50),
          longitude varchar(50),
          bedrooms int DEFAULT 1,
          bathrooms int DEFAULT 1,
          sizeSqm decimal(10,2),
          monthlyRent decimal(10,2),
          amenities json,
          utilitiesIncluded json,
          status enum('PENDING','APPROVED','REJECTED','CONVERTED') NOT NULL DEFAULT 'PENDING',
          adminNotes text,
          convertedPropertyId int,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] property_submissions table note:`, e?.message?.substring(0, 120));
        }
      }
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS submission_photos (
          id int AUTO_INCREMENT PRIMARY KEY,
          submissionId int NOT NULL,
          url text NOT NULL,
          sortOrder int DEFAULT 0,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] submission_photos table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure properties table has all required columns (migration 0020)
      const propertiesColumnFixes = [
        "ALTER TABLE `properties` ADD COLUMN `pricingSource` ENUM('PROPERTY','UNIT') NOT NULL DEFAULT 'PROPERTY'",
        "ALTER TABLE `properties` ADD COLUMN `submissionId` int DEFAULT NULL",
      ];
      for (const sql of propertiesColumnFixes) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] Properties migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] Properties migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure properties status enum includes all values
      try {
        await _pool.execute("ALTER TABLE `properties` MODIFY COLUMN `status` ENUM('draft','pending','active','inactive','rejected','published','archived') NOT NULL DEFAULT 'draft'");
      } catch (e: any) {
        // Ignore if already correct
      }
      // Auto-migrate: ensure availability_blocks table exists (for occupancy tracking)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS availability_blocks (
          id int AUTO_INCREMENT PRIMARY KEY,
          propertyId int NOT NULL,
          unitId int DEFAULT NULL,
          bookingId int DEFAULT NULL,
          blockType ENUM('BOOKING','MAINTENANCE','BEDS24_IMPORT','MANUAL_BLOCK') NOT NULL DEFAULT 'BOOKING',
          status ENUM('ACTIVE','CANCELLED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
          startDate date NOT NULL,
          endDate date NOT NULL,
          source ENUM('LOCAL','BEDS24','ICAL','ADMIN') NOT NULL DEFAULT 'LOCAL',
          sourceRef varchar(255) DEFAULT NULL,
          notes text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ab_propertyId (propertyId),
          INDEX idx_ab_bookingId (bookingId),
          INDEX idx_ab_dates (startDate, endDate),
          INDEX idx_ab_status (status),
          UNIQUE KEY uq_booking_block (bookingId, blockType)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] availability_blocks table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure unit_daily_status table exists (for occupancy snapshots)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS unit_daily_status (
          id int AUTO_INCREMENT PRIMARY KEY,
          date timestamp NOT NULL,
          buildingId int NOT NULL,
          unitId int NOT NULL,
          occupied boolean NOT NULL DEFAULT false,
          available boolean NOT NULL DEFAULT true,
          source ENUM('BEDS24','LOCAL','UNKNOWN') NOT NULL DEFAULT 'LOCAL',
          bookingRef varchar(100),
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_uds_date (date),
          INDEX idx_uds_unitId (unitId)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] unit_daily_status table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure beds24_map table exists (for Beds24 integration)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS beds24_map (
          id int AUTO_INCREMENT PRIMARY KEY,
          unitId int NOT NULL,
          beds24PropertyId varchar(100),
          beds24RoomId varchar(100),
          sourceOfTruth ENUM('BEDS24','LOCAL') NOT NULL DEFAULT 'LOCAL',
          connectionType ENUM('API','ICAL') DEFAULT NULL,
          icalImportUrl text,
          icalExportUrl text,
          beds24ApiKey varchar(255),
          lastSyncAt timestamp NULL,
          lastSyncStatus ENUM('SUCCESS','FAILED','PENDING') DEFAULT 'PENDING',
          lastSyncError text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_unitId (unitId)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] beds24_map table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure integration_logs table exists (for Beds24 sync logging)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS integration_logs (
          id int AUTO_INCREMENT PRIMARY KEY,
          integrationKey varchar(50) NOT NULL DEFAULT 'beds24',
          direction ENUM('INBOUND','OUTBOUND','RECONCILE') NOT NULL,
          action varchar(100) NOT NULL,
          entityType varchar(50) DEFAULT NULL,
          entityId varchar(100) DEFAULT NULL,
          requestPayload JSON DEFAULT NULL,
          responsePayload JSON DEFAULT NULL,
          status ENUM('SUCCESS','FAILED','SKIPPED') NOT NULL DEFAULT 'SUCCESS',
          errorMessage text DEFAULT NULL,
          durationMs int DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_il_key (integrationKey),
          INDEX idx_il_direction (direction),
          INDEX idx_il_status (status),
          INDEX idx_il_created (createdAt)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] integration_logs table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: add externalReservationId to bookings
      const beds24BookingMigrations = [
        "ALTER TABLE `bookings` ADD COLUMN `externalReservationId` varchar(255) DEFAULT NULL",
      ];
      for (const mig of beds24BookingMigrations) {
        try { await _pool.execute(mig); } catch (e: any) { /* column already exists */ }
      }
      // Auto-migrate: extend audit_log ENUMs for WhatsApp
      const auditMigrations = [
        `ALTER TABLE audit_log MODIFY COLUMN action ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND') NOT NULL`,
        `ALTER TABLE audit_log MODIFY COLUMN entityType ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE') NOT NULL`,
      ];
      for (const migSql of auditMigrations) {
        try {
          await _pool.execute(migSql);
        } catch (e: any) {
          // Ignore if already has the values
          if (!e?.message?.includes('Duplicate')) {
            console.warn("[Database] audit_log migration note:", e?.message?.substring(0, 100));
          }
        }
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function getPool() { return _pool; }

// ─── Transaction Helper ──────────────────────────────────────────────
/**
 * Execute multiple DB operations atomically within a transaction.
 * If any step throws, all changes are rolled back.
 * Usage: await withTransaction(async (tx) => { ... });
 */
export async function withTransaction<T>(
  fn: (tx: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return (db as any).transaction(fn);
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
  // Role is assigned explicitly during registration or by admin. No auto-admin via env var.
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

export async function getAllUsers(limit = 50, offset = 0, search?: string, role?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(users.name, term),
      like(users.nameAr, term),
      like(users.displayName, term),
      like(users.email, term),
      like(users.phone, term),
    ));
  }
  if (role && role !== 'all') {
    conditions.push(eq(users.role, role as any));
  }
  // Left join adminPermissions to include isRootAdmin flag
  const baseQuery = db.select({
    id: users.id, openId: users.openId, userId: users.userId,
    displayName: users.displayName, name: users.name, nameAr: users.nameAr,
    email: users.email, phone: users.phone, whatsapp: users.whatsapp,
    role: users.role, avatarUrl: users.avatarUrl, isVerified: users.isVerified,
    createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
    recoveryEmail: users.recoveryEmail,
    isRootAdmin: adminPermissions.isRootAdmin,
  }).from(users)
    .leftJoin(adminPermissions, eq(users.id, adminPermissions.userId));
  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions)).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }
  return baseQuery.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
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
  query?: string; city?: string; propertyType?: string; minPrice?: number; maxPrice?: number;
  bedrooms?: number; furnishedLevel?: string; status?: string;
  limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(properties.status, "published")];
  if (filters.query) {
    const q = `%${filters.query}%`;
    conditions.push(or(
      like(properties.titleAr, q),
      like(properties.titleEn, q),
      like(properties.city, q),
      like(properties.cityAr, q),
      like(properties.district, q),
      like(properties.districtAr, q),
      like(properties.descriptionAr, q),
      like(properties.descriptionEn, q),
    )!);
  }
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

export async function getMapProperties(filters?: {
  city?: string; propertyType?: string; minPrice?: number; maxPrice?: number;
  bedrooms?: number; furnishedLevel?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(properties.status, "published")];
  if (filters?.city) conditions.push(like(properties.city, `%${filters.city}%`));
  if (filters?.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType as any));
  if (filters?.minPrice) conditions.push(gte(properties.monthlyRent, String(filters.minPrice)));
  if (filters?.maxPrice) conditions.push(lte(properties.monthlyRent, String(filters.maxPrice)));
  if (filters?.bedrooms) conditions.push(eq(properties.bedrooms, filters.bedrooms));
  if (filters?.furnishedLevel) conditions.push(eq(properties.furnishedLevel, filters.furnishedLevel as any));
  // Only return properties with valid coordinates (not null, not empty, not zero)
  conditions.push(sql`${properties.latitude} IS NOT NULL AND ${properties.latitude} != '' AND ${properties.latitude} != '0'`);
  conditions.push(sql`${properties.longitude} IS NOT NULL AND ${properties.longitude} != '' AND ${properties.longitude} != '0'`);
  const where = and(...conditions);
  return db.select({
    id: properties.id,
    titleEn: properties.titleEn,
    titleAr: properties.titleAr,
    propertyType: properties.propertyType,
    city: properties.city,
    cityAr: properties.cityAr,
    district: properties.district,
    districtAr: properties.districtAr,
    latitude: properties.latitude,
    longitude: properties.longitude,
    monthlyRent: properties.monthlyRent,
    bedrooms: properties.bedrooms,
    bathrooms: properties.bathrooms,
    sizeSqm: properties.sizeSqm,
    furnishedLevel: properties.furnishedLevel,
    photos: properties.photos,
    isFeatured: properties.isFeatured,
  }).from(properties).where(where!).limit(500);
}

export async function getAllProperties(limit = 50, offset = 0, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (status) conditions.push(eq(properties.status, status as any));
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(properties.titleEn, term),
      like(properties.titleAr, term),
      like(properties.city, term),
      like(properties.cityAr, term),
    ));
  }
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
  // Soft delete: archive instead of hard delete to preserve data integrity
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set({ status: 'archived' }).where(eq(properties.id, id));
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
  // Include both 'completed' (manual override) and 'paid' (Moyasar webhook) statuses
  const result = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(payments)
    .where(sql`${payments.status} IN ('completed', 'paid')`);
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

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

export async function getAllPayments(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset(offset);
}

export async function updatePaymentStatus(id: number, status: string, paidAt?: Date) {
  const db = await getDb();
  if (!db) return;
  const data: any = { status };
  if (paidAt) data.paidAt = paidAt;
  await db.update(payments).set(data).where(eq(payments.id, id));
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

export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
      .where(and(inArray(properties.id, propertyIds), eq(properties.status, 'published')));
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
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount,
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
      COALESCE(SUM(CASE WHEN status IN ('completed', 'paid') THEN amount ELSE 0 END), 0) AS revenue,
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
    WHERE status = 'published'
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
    WHERE status = 'published'
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
    WHERE p.status = 'published'
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
  if (!db) return { occupancyRate: 0, activeBookings: 0, activeProperties: 0, bookedDays: 0, totalPropertyDays: 0 };
  // Count active bookings
  const [bookingResult] = await db.select({ count: sql<number>`count(*)` }).from(bookings)
    .where(eq(bookings.status, "active"));
  // Count published/active properties
  const [propertyResult] = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(sql`${properties.status} IN ('published', 'active')`);
  const activeBookingsCount = bookingResult?.count ?? 0;
  const activePropertiesCount = propertyResult?.count ?? 0;

  // Try to use availability_blocks for date-based occupancy (preferred)
  let occupancyRate = 0;
  let bookedDays = 0;
  let totalPropertyDays = activePropertiesCount * 30; // last 30 days
  try {
    const { getOccupancyStats } = await import('./availability-blocks.js');
    const stats = await getOccupancyStats(30);
    occupancyRate = stats.occupancyRate;
    bookedDays = stats.bookedDays;
    totalPropertyDays = stats.totalPropertyDays;
  } catch {
    // Fallback: simple ratio if availability_blocks table doesn't exist yet
    occupancyRate = activePropertiesCount > 0 ? Math.round((activeBookingsCount / activePropertiesCount) * 100) : 0;
  }

  return { occupancyRate, activeBookings: activeBookingsCount, activeProperties: activePropertiesCount, bookedDays, totalPropertyDays };
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


// ─── WhatsApp Messages ──────────────────────────────────────────────
export async function createWhatsAppMessage(data: {
  recipientPhone: string;
  recipientName: string | null;
  userId: number | null;
  messageType: string;
  templateName: string | null;
  messageBody: string;
  propertyId: number | null;
  bookingId: number | null;
  channel: string;
  sentBy: number;
  status: string;
  sentAt: Date;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");
  // Auto-create table if not exists
  await pool.execute(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipientPhone VARCHAR(20) NOT NULL,
    recipientName VARCHAR(255),
    userId INT,
    messageType ENUM('property_share','booking_reminder','follow_up','custom','welcome','payment_reminder') NOT NULL,
    templateName VARCHAR(100),
    messageBody TEXT,
    propertyId INT,
    bookingId INT,
    status ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending' NOT NULL,
    providerMsgId VARCHAR(255),
    channel ENUM('click_to_chat','cloud_api') DEFAULT 'click_to_chat' NOT NULL,
    sentBy INT,
    errorMessage TEXT,
    sentAt TIMESTAMP NULL,
    deliveredAt TIMESTAMP NULL,
    readAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  const [result] = await pool.query(
    `INSERT INTO whatsapp_messages (recipientPhone, recipientName, userId, messageType, templateName, messageBody, propertyId, bookingId, channel, sentBy, status, sentAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [data.recipientPhone, data.recipientName, data.userId, data.messageType, data.templateName, data.messageBody, data.propertyId, data.bookingId, data.channel, data.sentBy, data.status, data.sentAt]
  );
  return (result as any).insertId as number;
}

export async function listWhatsAppMessages(filters: { limit?: number; offset?: number; messageType?: string; status?: string }) {
  const pool = getPool();
  if (!pool) return { messages: [], total: 0 };
  let where = "1=1";
  const params: any[] = [];
  if (filters.messageType) { where += " AND messageType = ?"; params.push(filters.messageType); }
  if (filters.status) { where += " AND status = ?"; params.push(filters.status); }
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  try {
    const [rows] = await pool.query(`SELECT * FROM whatsapp_messages WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM whatsapp_messages WHERE ${where}`, params);
    return { messages: rows as any[], total: (countResult as any[])[0]?.total || 0 };
  } catch {
    return { messages: [], total: 0 };
  }
}

export async function getWhatsAppStats() {
  const pool = getPool();
  if (!pool) return { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as totalMessages,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as \`read\`,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as last24h,
        SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last7d
      FROM whatsapp_messages
    `);
    return (rows as any[])[0] || { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  } catch {
    return { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  }
}


// ─── Property Submissions (Lead Intake) ──────────────────────────────
export async function createPropertySubmission(data: InsertPropertySubmission) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertySubmissions).values(data);
  return result[0].insertId;
}

export async function getPropertySubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(propertySubmissions).where(eq(propertySubmissions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllPropertySubmissions(limit = 50, offset = 0, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (status && status !== "all") {
    conditions.push(eq(propertySubmissions.status, status as any));
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(propertySubmissions.ownerName, term),
      like(propertySubmissions.ownerNameAr, term),
      like(propertySubmissions.phone, term),
      like(propertySubmissions.email, term),
      like(propertySubmissions.city, term),
      like(propertySubmissions.cityAr, term),
    ));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const items = await db.select().from(propertySubmissions)
    .where(where!)
    .orderBy(desc(propertySubmissions.createdAt))
    .limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions).where(where!);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function updatePropertySubmission(id: number, data: Partial<InsertPropertySubmission>) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertySubmissions).set(data as any).where(eq(propertySubmissions.id, id));
}

export async function getSubmissionPhotosBySubmissionId(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissionPhotos)
    .where(eq(submissionPhotos.submissionId, submissionId))
    .orderBy(asc(submissionPhotos.sortOrder));
}

export async function addSubmissionPhoto(data: InsertSubmissionPhoto) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(submissionPhotos).values(data);
  return result[0].insertId;
}

export async function deleteSubmissionPhoto(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(submissionPhotos).where(eq(submissionPhotos.id, id));
}

export async function getPropertySubmissionCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  if (status && status !== "all") {
    const result = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions)
      .where(eq(propertySubmissions.status, status as any));
    return result[0]?.count ?? 0;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions);
  return result[0]?.count ?? 0;
}

// ─── WhatsApp Templates (DB-stored, admin-managed) ──────────────────

export async function ensureWhatsAppTemplatesTable() {
  const pool = getPool();
  if (!pool) return;
  await pool.execute(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    templateKey VARCHAR(100) NOT NULL UNIQUE,
    nameEn VARCHAR(255) NOT NULL,
    nameAr VARCHAR(255) NOT NULL,
    metaTemplateName VARCHAR(255) DEFAULT NULL COMMENT 'Meta-approved template name for Cloud API',
    languageCode VARCHAR(10) DEFAULT 'ar',
    messageType ENUM('property_share','booking_reminder','follow_up','custom','welcome','payment_reminder','booking_approved','booking_rejected') NOT NULL,
    bodyEn TEXT,
    bodyAr TEXT,
    variableKeys JSON COMMENT 'Array of variable placeholder names',
    isActive BOOLEAN DEFAULT TRUE NOT NULL,
    channel ENUM('click_to_chat','cloud_api','both') DEFAULT 'both' NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
  )`);
}

export async function listWhatsAppTemplates(activeOnly: boolean = false) {
  const pool = getPool();
  if (!pool) return [];
  await ensureWhatsAppTemplatesTable();
  const where = activeOnly ? "WHERE isActive = TRUE" : "";
  const [rows] = await pool.query(`SELECT * FROM whatsapp_templates ${where} ORDER BY createdAt DESC`);
  return rows as any[];
}

export async function getWhatsAppTemplate(id: number) {
  const pool = getPool();
  if (!pool) return null;
  await ensureWhatsAppTemplatesTable();
  const [rows] = await pool.query(`SELECT * FROM whatsapp_templates WHERE id = ?`, [id]);
  return (rows as any[])[0] || null;
}

export async function createWhatsAppTemplateRecord(data: {
  templateKey: string; nameEn: string; nameAr: string; metaTemplateName?: string;
  languageCode?: string; messageType: string; bodyEn?: string; bodyAr?: string;
  variableKeys?: string[]; channel?: string;
}) {
  const pool = getPool();
  if (!pool) return null;
  await ensureWhatsAppTemplatesTable();
  const [result] = await pool.query(
    `INSERT INTO whatsapp_templates (templateKey, nameEn, nameAr, metaTemplateName, languageCode, messageType, bodyEn, bodyAr, variableKeys, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.templateKey, data.nameEn, data.nameAr, data.metaTemplateName || null, data.languageCode || 'ar',
     data.messageType, data.bodyEn || null, data.bodyAr || null,
     data.variableKeys ? JSON.stringify(data.variableKeys) : null, data.channel || 'both']
  );
  return (result as any).insertId;
}

export async function updateWhatsAppTemplateRecord(id: number, data: {
  nameEn?: string; nameAr?: string; metaTemplateName?: string; languageCode?: string;
  messageType?: string; bodyEn?: string; bodyAr?: string; variableKeys?: string[];
  isActive?: boolean; channel?: string;
}) {
  const pool = getPool();
  if (!pool) return;
  const sets: string[] = [];
  const params: any[] = [];
  if (data.nameEn !== undefined) { sets.push("nameEn = ?"); params.push(data.nameEn); }
  if (data.nameAr !== undefined) { sets.push("nameAr = ?"); params.push(data.nameAr); }
  if (data.metaTemplateName !== undefined) { sets.push("metaTemplateName = ?"); params.push(data.metaTemplateName); }
  if (data.languageCode !== undefined) { sets.push("languageCode = ?"); params.push(data.languageCode); }
  if (data.messageType !== undefined) { sets.push("messageType = ?"); params.push(data.messageType); }
  if (data.bodyEn !== undefined) { sets.push("bodyEn = ?"); params.push(data.bodyEn); }
  if (data.bodyAr !== undefined) { sets.push("bodyAr = ?"); params.push(data.bodyAr); }
  if (data.variableKeys !== undefined) { sets.push("variableKeys = ?"); params.push(JSON.stringify(data.variableKeys)); }
  if (data.isActive !== undefined) { sets.push("isActive = ?"); params.push(data.isActive); }
  if (data.channel !== undefined) { sets.push("channel = ?"); params.push(data.channel); }
  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE whatsapp_templates SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteWhatsAppTemplateRecord(id: number) {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`DELETE FROM whatsapp_templates WHERE id = ?`, [id]);
}

export async function seedDefaultWhatsAppTemplates() {
  const pool = getPool();
  if (!pool) return;
  await ensureWhatsAppTemplatesTable();
  const [existing] = await pool.query(`SELECT COUNT(*) as cnt FROM whatsapp_templates`);
  if ((existing as any[])[0]?.cnt > 0) return;
  const defaults = [
    { templateKey: "welcome", nameEn: "Welcome New Tenant", nameAr: "ترحيب بمستأجر جديد", messageType: "welcome",
      bodyEn: "Welcome {name}! 🏠\nWelcome to Monthly Key. We're happy to have you.\nIf you need any help, don't hesitate to reach out.",
      bodyAr: "مرحباً {name}! 🏠\nأهلاً بك في Monthly Key. نحن سعداء بانضمامك.\nإذا احتجت أي مساعدة، لا تتردد في التواصل معنا.",
      variableKeys: ["name"] },
    { templateKey: "booking_confirm", nameEn: "Booking Confirmation", nameAr: "تأكيد حجز", messageType: "booking_reminder",
      bodyEn: "Hi {name}! ✅\nYour booking is confirmed for: {property}\nMove-in: {date}\nMonthly rent: {rent} SAR",
      bodyAr: "مرحباً {name}! ✅\nتم تأكيد حجزك للعقار: {property}\nتاريخ الدخول: {date}\nالإيجار الشهري: {rent} ر.س",
      variableKeys: ["name", "property", "date", "rent"] },
    { templateKey: "payment_reminder", nameEn: "Payment Reminder", nameAr: "تذكير بالدفع", messageType: "payment_reminder",
      bodyEn: "Hi {name} 💰\nReminder for your monthly rent for: {property}\nAmount: {rent} SAR",
      bodyAr: "مرحباً {name} 💰\nنذكرك بموعد دفع الإيجار الشهري للعقار: {property}\nالمبلغ: {rent} ر.س",
      variableKeys: ["name", "property", "rent"] },
    { templateKey: "booking_approved", nameEn: "Booking Approved", nameAr: "تمت الموافقة على الحجز", messageType: "booking_approved",
      bodyEn: "Hi {name}! ✅\nYour booking for {property} has been approved.\nPlease proceed with payment.",
      bodyAr: "مرحباً {name}! ✅\nتمت الموافقة على حجزك للعقار: {property}\nيرجى إتمام الدفع لتأكيد الحجز.",
      variableKeys: ["name", "property"] },
    { templateKey: "booking_rejected", nameEn: "Booking Rejected", nameAr: "تم رفض الحجز", messageType: "booking_rejected",
      bodyEn: "Hi {name},\nYour booking for {property} could not be approved.\nReason: {reason}",
      bodyAr: "مرحباً {name},\nللأسف لم تتم الموافقة على حجزك للعقار: {property}\nالسبب: {reason}",
      variableKeys: ["name", "property", "reason"] },
    { templateKey: "follow_up", nameEn: "Follow Up", nameAr: "متابعة", messageType: "follow_up",
      bodyEn: "Hi {name}! 👋\nWe hope you're enjoying your stay. Need any help?",
      bodyAr: "مرحباً {name}! 👋\nنتمنى أنك مستمتع بإقامتك. هل تحتاج أي مساعدة؟",
      variableKeys: ["name"] },
    { templateKey: "custom", nameEn: "Custom Message", nameAr: "رسالة مخصصة", messageType: "custom",
      bodyEn: "", bodyAr: "", variableKeys: [] },
  ];
  for (const t of defaults) {
    await pool.query(
      `INSERT INTO whatsapp_templates (templateKey, nameEn, nameAr, messageType, bodyEn, bodyAr, variableKeys, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'both')`,
      [t.templateKey, t.nameEn, t.nameAr, t.messageType, t.bodyEn, t.bodyAr, JSON.stringify(t.variableKeys)]
    );
  }
}

// ─── WhatsApp Delivery Status Updates ───────────────────────────────

export async function updateWhatsAppMessageStatus(providerMsgId: string, status: string, timestamp?: Date) {
  const pool = getPool();
  if (!pool) return;
  try {
    const sets: string[] = [`status = ?`];
    const params: any[] = [status];
    if (status === "delivered" && timestamp) { sets.push("deliveredAt = ?"); params.push(timestamp); }
    if (status === "read" && timestamp) { sets.push("readAt = ?"); params.push(timestamp); }
    if (status === "failed") { sets.push("errorMessage = COALESCE(errorMessage, 'Delivery failed')"); }
    params.push(providerMsgId);
    await pool.query(`UPDATE whatsapp_messages SET ${sets.join(", ")} WHERE providerMsgId = ?`, params);
  } catch {
    // Silently ignore - delivery status is best-effort
  }
}
