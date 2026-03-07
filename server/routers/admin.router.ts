import {
  TRPCError, z, router,
  publicProcedure, protectedProcedure, adminProcedure, adminWithPermission,
  PERMISSIONS, PERMISSION_CATEGORIES, clearPermissionCache,
  db, withTransaction, cache, cacheThrough, CACHE_TTL, CACHE_KEYS,
  rateLimiter, RATE_LIMITS, getClientIP,
  storagePut, nanoid,
  notifyOwner, logAudit,
  ENV, dbIdentity,
  sanitizeText, sanitizeObject, validateContentType, validateFileExtension,
  MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_UPLOAD_TYPES,
  capLimit, capOffset, isOwnerOrAdmin, isBookingParticipant,
  sharedDb,
  rolesTable, aiMessagesTable, whatsappMessages, units, auditLog, integrationConfigs,
  eqDrizzle, andDrizzle, neDrizzle,
  optimizeImage, optimizeAvatar,
  sendBookingConfirmation, sendPaymentReceipt, sendMaintenanceUpdate, sendNewMaintenanceAlert,
  verifySmtpConnection, isSmtpConfigured,
  savePushSubscription, removePushSubscription, sendPushToUser, sendPushBroadcast,
  isPushConfigured, getUserSubscriptionCount,
  sendTemplateMessage, sendTextMessage, getWhatsAppConfig, formatPhoneForWhatsApp, maskPhone,
  getAiResponse, seedDefaultKnowledgeBase,
  getKBSections, getAdminKBForCopilot,
  generateLeaseContractHTML,
  createPayPalOrder, capturePayPalOrder, getPayPalSettings,
  isBreakglassAdmin, isFlagOn,
  calculateBookingTotal, parseCalcSettings,
  getSessionCookieOptions, sdk,
  parseCookieHeader,
} from "./_shared";

// Domain: admin
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const adminRouterDefs = {
  admin: router({
    // ─── DB Status (RBAC: MANAGE_SETTINGS) ────────────────────────────
    dbStatus: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
      const pool = db.getPool();
      let dbConnected = false;
      let dbVersion = "unknown";
      let tableCount = 0;
      let migrationVersion = "unknown";
      let migrationEntries: Array<{ hash: string; created_at: number }> = [];
      let uptime = 0;

      if (pool) {
        try {
          // Test connection
          await pool.execute("SELECT 1");
          dbConnected = true;

          // Get MySQL version
          const [versionRows] = await pool.execute("SELECT VERSION() as v") as any;
          dbVersion = versionRows?.[0]?.v ?? "unknown";

          // Count tables in current database
          const [tableRows] = await pool.execute(
            "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()"
          ) as any;
          tableCount = tableRows?.[0]?.cnt ?? 0;

          // Get migration journal from __drizzle_migrations table
          try {
            const [migRows] = await pool.execute(
              "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5"
            ) as any;
            migrationEntries = migRows ?? [];
            if (migRows?.length > 0) {
              migrationVersion = `${migRows.length > 0 ? migRows[0].hash?.slice(0, 12) : 'none'} (${migRows.length} of total)`;
            }
          } catch {
            migrationVersion = "migrations table not found";
          }

          // Get total migration count
          try {
            const [countRows] = await pool.execute(
              "SELECT COUNT(*) as cnt FROM __drizzle_migrations"
            ) as any;
            const totalMigrations = countRows?.[0]?.cnt ?? 0;
            migrationVersion = `${totalMigrations} migrations applied`;
          } catch {}

          // Server uptime
          const [uptimeRows] = await pool.execute("SHOW STATUS LIKE 'Uptime'") as any;
          uptime = parseInt(uptimeRows?.[0]?.Value ?? "0");
        } catch (e: any) {
          console.error("[Admin] DB status check failed:", e.message);
        }
      }

      return {
        connected: dbConnected,
        environment: ENV.appEnvironment,
        isPreviewDeploy: ENV.isPreviewDeploy,
        host: dbIdentity.host,
        port: dbIdentity.port,
        database: dbIdentity.database,
        mysqlVersion: dbVersion,
        tableCount,
        migrationVersion,
        recentMigrations: migrationEntries.map(m => ({
          hash: m.hash?.slice(0, 16) ?? "unknown",
          appliedAt: m.created_at ? new Date(m.created_at).toISOString() : "unknown",
        })),
        serverUptimeSeconds: uptime,
        checkedAt: new Date().toISOString(),
        // Debug: check actual table columns
        tableColumns: await (async () => {
          try {
            const [cols] = await pool!.execute(
              "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'property_submissions' ORDER BY ORDINAL_POSITION"
            ) as any;
            return cols.map((c: any) => `${c.COLUMN_NAME}:${c.DATA_TYPE}`);
          } catch { return []; }
        })(),
        drizzleMigrations: await (async () => {
          try {
            const [rows] = await pool!.execute(
              "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC"
            ) as any;
            return rows.map((r: any) => r.hash);
          } catch { return []; }
        })(),
      };
    }),

    stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).query(async () => {
      const [userCount, propertyCount, activeProperties, pendingProperties, publishedProperties, bookingCount, activeBookings, approvedBookings, pendingBookings, totalRevenue, occupancy] = await Promise.all([
        db.getUserCount(),
        db.getPropertyCount(),
        db.getPropertyCount("active"),
        db.getPropertyCount("pending"),
        db.getPropertyCount("published"),
        db.getBookingCount(),
        db.getBookingCount("active"),
        db.getBookingCount("approved"),
        db.getBookingCount("pending"),
        db.getTotalRevenue(),
        db.getOccupancyRate(),
      ]);
      return {
        userCount, propertyCount, activeProperties, pendingProperties, publishedProperties,
        bookingCount, activeBookings, approvedBookings, pendingBookings,
        totalRevenue,
        occupancyRate: occupancy.occupancyRate,
        bookedDays: occupancy.bookedDays,
        totalPropertyDays: occupancy.totalPropertyDays,
      };
     }),
    backfillAvailabilityBlocks: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).mutation(async () => {
      const { backfillFromBookings } = await import('../availability-blocks.js');
      const count = await backfillFromBookings();
      return { success: true, blocksCreated: count };
    }),
    users: adminWithPermission(PERMISSIONS.MANAGE_USERS)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().max(200).optional(), role: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getAllUsers(input.limit, input.offset, input.search, input.role);
      }),

    updateUserRole: adminWithPermission(PERMISSIONS.MANAGE_USERS)
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "landlord", "tenant"]) }))
      .mutation(async ({ input }) => {
        // Protect root admin from being demoted
        const targetPerms = await db.getAdminPermissions(input.userId);
        if (targetPerms?.isRootAdmin && input.role !== "admin") {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change root admin role' });
        }
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    properties: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), status: z.string().optional(), search: z.string().optional() }))
      .query(async ({ input }) => {
        const items = await db.getAllProperties(input.limit, input.offset, input.status, input.search);
        const total = await db.getPropertyCount(input.status);
        // Add server-computed coverImageUrl for reliable image display
        const s3Base = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
        const enriched = items.map((item: any) => {
          let coverImageUrl = "";
          const photos = item.photos;
          if (Array.isArray(photos) && photos.length > 0) {
            const first = typeof photos[0] === "string" ? photos[0] : (photos[0] as any)?.url || "";
            if (first) {
              coverImageUrl = first.startsWith("http") ? first
                : s3Base ? `${s3Base}/${first.replace(/^\/+/, "")}`
                : first;
            }
          }
          return { ...item, coverImageUrl };
        });
        return { items: enriched, total };
      }),

    approveProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number(), status: z.enum(["active", "rejected", "published", "draft", "archived"]), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Publish guard: if setting to 'published', enforce the same validation as publishProperty
        if (input.status === 'published') {
          const prop = await db.getPropertyById(input.id);
          if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
          const errors: string[] = [];
          if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
            if (!prop.monthlyRent || Number(prop.monthlyRent) <= 0) errors.push('monthlyRent must be > 0 / الإيجار الشهري يجب أن يكون أكبر من 0');
          } else if ((prop as any).pricingSource === 'UNIT') {
            const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
            const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
            if (validUnits.length !== 1) errors.push('UNIT pricing requires exactly one linked unit / تسعير الوحدة يتطلب وحدة واحدة مرتبطة');
            else if (!validUnits[0].monthlyBaseRentSAR || Number(validUnits[0].monthlyBaseRentSAR) <= 0) errors.push('Linked unit must have rent > 0 / الوحدة المرتبطة يجب أن يكون لها إيجار');
          }
          if (!prop.titleEn && !prop.titleAr) errors.push('Property must have at least one title / يجب أن يكون للعقار عنوان');
          const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
          if (!hasPhotos) errors.push('Property must have at least one photo / يجب أن يكون للعقار صورة واحدة على الأقل');
          if (errors.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `Publish guard failed: ${errors.join('; ')}` });
        }
        await db.updateProperty(input.id, { status: input.status });
        return { success: true };
      }),

    // Publish with guard validation
    publishProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        const errors: { en: string; ar: string }[] = [];
        // 1. Title check
        if (!prop.titleEn && !prop.titleAr) errors.push({ en: 'Property must have at least one title', ar: 'يجب أن يكون للعقار عنوان واحد على الأقل' });
        // 2. Pricing check
        if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
          if (!prop.monthlyRent || Number(prop.monthlyRent) <= 0) errors.push({ en: 'Monthly rent must be greater than 0', ar: 'الإيجار الشهري يجب أن يكون أكبر من 0' });
        } else if ((prop as any).pricingSource === 'UNIT') {
          const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
          const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
          if (validUnits.length !== 1) errors.push({ en: `UNIT pricing requires exactly one linked unit (found ${validUnits.length})`, ar: `تسعير الوحدة يتطلب وحدة واحدة مرتبطة (وجدت ${validUnits.length})` });
          else if (!validUnits[0].monthlyBaseRentSAR || Number(validUnits[0].monthlyBaseRentSAR) <= 0) errors.push({ en: 'Linked unit must have rent > 0', ar: 'الوحدة المرتبطة يجب أن يكون إيجارها أكبر من 0' });
        }
        // 3. Photos check
        const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
        if (!hasPhotos) errors.push({ en: 'Property must have at least one photo', ar: 'يجب أن يكون للعقار صورة واحدة على الأقل' });
        // 4. Cover photo check — first photo in the photos array is the cover by design
        // No separate coverPhoto column exists; the array order determines the cover.
        // 5. Location check
        if (!prop.city && !prop.cityAr) errors.push({ en: 'Property must have a city/location', ar: 'يجب تحديد مدينة/موقع العقار' });
        if (errors.length > 0) {
          const combined = errors.map(e => `${e.en} / ${e.ar}`).join('; ');
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Publish guard failed: ${combined}` });
        }
        await db.updateProperty(input.id, { status: 'published' });
        await sharedDb.insert(auditLog).values({
          userId: ctx.user?.id ?? null,
          userName: ctx.user?.displayName ?? 'system',
          action: 'PUBLISH',
          entityType: 'PROPERTY',
          entityId: input.id,
          entityLabel: prop.titleEn || prop.titleAr,
        });
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        // Structured log for property publish
        process.stdout.write(JSON.stringify({
          ts: new Date().toISOString(), level: 'info', component: 'publish',
          msg: 'Property published', propertyId: input.id, adminId: ctx.user?.id,
          title: prop.titleEn || prop.titleAr, pricingSource: (prop as any).pricingSource || 'PROPERTY',
        }) + '\n');
        return { success: true };
      }),

    unpublishProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateProperty(input.id, { status: 'draft' });
        const prop = await db.getPropertyById(input.id);
        await sharedDb.insert(auditLog).values({
          userId: ctx.user?.id ?? null,
          userName: ctx.user?.displayName ?? 'system',
          action: 'UNPUBLISH',
          entityType: 'PROPERTY',
          entityId: input.id,
          entityLabel: prop?.titleEn || prop?.titleAr || `Property #${input.id}`,
        });
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    archiveProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateProperty(input.id, { status: 'archived' });
        await sharedDb.insert(auditLog).values({
          userId: ctx.user?.id ?? null,
          userName: ctx.user?.displayName ?? 'system',
          action: 'ARCHIVE',
          entityType: 'PROPERTY',
          entityId: input.id,
          entityLabel: `Property #${input.id}`,
        });
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    publishReadiness: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND' });
        const checks: { label: string; labelAr: string; labelEn: string; passed: boolean; detail?: string; required?: boolean }[] = [];
        // Required checks (block publish)
        checks.push({ label: 'Has title', labelAr: 'يوجد عنوان', labelEn: 'Has title', passed: !!(prop.titleEn || prop.titleAr), required: true });
        if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
          checks.push({ label: 'Monthly rent > 0', labelAr: 'الإيجار الشهري > 0', labelEn: 'Monthly rent > 0', passed: Number(prop.monthlyRent) > 0, detail: `SAR ${prop.monthlyRent}`, required: true });
        } else {
          const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
          const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
          let unitCheck = { passed: false, detail: 'No linked unit' };
          if (validUnits.length === 1 && Number(validUnits[0].monthlyBaseRentSAR) > 0) {
            unitCheck = { passed: true, detail: `Unit #${validUnits[0].unitNumber}: SAR ${validUnits[0].monthlyBaseRentSAR}` };
          } else if (validUnits.length !== 1) {
            unitCheck = { passed: false, detail: `Found ${validUnits.length} valid units (need exactly 1)` };
          } else {
            unitCheck = { passed: false, detail: 'Unit rent is 0 or null' };
          }
          checks.push({ label: 'Linked unit with valid rent', labelAr: 'وحدة مرتبطة بإيجار صالح', labelEn: 'Linked unit with valid rent', ...unitCheck, required: true });
        }
        const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
        checks.push({ label: 'Has photos', labelAr: 'يوجد صور', labelEn: 'Has photos', passed: !!hasPhotos, detail: hasPhotos ? `${(prop.photos as string[]).length} photos` : 'No photos', required: true });
        checks.push({ label: 'Has location', labelAr: 'يوجد موقع', labelEn: 'Has location', passed: !!(prop.city || prop.cityAr), required: true });
        // Warning checks (do NOT block publish)
        const hasCoords = !!(prop.latitude && prop.longitude && Number(prop.latitude) !== 0);
        checks.push({ label: 'Has coordinates', labelAr: 'يوجد إحداثيات', labelEn: 'Has coordinates', passed: hasCoords, detail: hasCoords ? `${prop.latitude}, ${prop.longitude}` : 'Recommended for map visibility', required: false });
        // ready = all REQUIRED checks pass (warnings don't block)
        const allRequiredPassed = checks.filter(c => c.required !== false).every(c => c.passed);
        return { ready: allRequiredPassed, checks, pricingSource: (prop as any).pricingSource || 'PROPERTY', status: prop.status };
      }),

    // Admin create property (creates as DRAFT)
    adminCreate: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        googleMapsUrl: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]).optional(),
        locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
        placeId: z.string().optional(),
        geocodeProvider: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        monthlyRent: z.string(),
        securityDeposit: z.string().optional(),
        pricingSource: z.enum(["PROPERTY", "UNIT"]).optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProperty({
          ...input,
          landlordId: ctx.user.id,
          status: 'draft',
          pricingSource: input.pricingSource || 'PROPERTY',
          locationSource: input.locationSource || 'MANUAL',
        } as any);
        await sharedDb.insert(auditLog).values({
          userId: ctx.user.id,
          userName: ctx.user.displayName ?? 'admin',
          action: 'CREATE',
          entityType: 'PROPERTY',
          entityId: id,
          entityLabel: input.titleEn || input.titleAr,
        });
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { id };
      }),

    // Admin update property
    adminUpdate: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]).optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        googleMapsUrl: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]).optional(),
        locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
        placeId: z.string().optional(),
        geocodeProvider: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        monthlyRent: z.string().optional(),
        securityDeposit: z.string().optional(),
        pricingSource: z.enum(["PROPERTY", "UNIT"]).optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        photos: z.array(z.string()).optional(),
        status: z.enum(["draft", "pending", "active", "inactive", "rejected", "published", "archived"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const prop = await db.getPropertyById(id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND' });

        // Publish guard: block setting status to 'published' via adminUpdate
        // Must use publishProperty endpoint instead, which has full validation
        if (data.status === 'published' && prop.status !== 'published') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot publish via adminUpdate. Use publishProperty endpoint which validates readiness / لا يمكن النشر عبر التحديث. استخدم زر النشر الذي يتحقق من الجاهزية',
          });
        }

        // ── Location Contract: sanitize + validate ──
        const cleaned: any = { ...data };

        // 1. Clean empty strings → null for numeric/URL columns
        const nullableFields = ['monthlyRent', 'securityDeposit', 'latitude', 'longitude', 'sizeSqm', 'googleMapsUrl', 'placeId', 'geocodeProvider', 'address', 'addressAr'];
        for (const key of Object.keys(cleaned)) {
          if (cleaned[key] === '' && nullableFields.includes(key)) {
            cleaned[key] = null;
          }
        }

        // 2. Validate lat/lng are valid decimals when present
        if (cleaned.latitude != null) {
          const lat = parseFloat(String(cleaned.latitude));
          if (isNaN(lat) || lat < -90 || lat > 90) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid latitude (must be -90 to 90) / \u062e\u0637 \u0627\u0644\u0639\u0631\u0636 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
          }
        }
        if (cleaned.longitude != null) {
          const lng = parseFloat(String(cleaned.longitude));
          if (isNaN(lng) || lng < -180 || lng > 180) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid longitude (must be -180 to 180) / \u062e\u0637 \u0627\u0644\u0637\u0648\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
          }
        }

        // 3. Validate googleMapsUrl is a valid URL when present
        if (cleaned.googleMapsUrl && typeof cleaned.googleMapsUrl === 'string') {
          try {
            const url = new URL(cleaned.googleMapsUrl);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
          } catch {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Google Maps URL / \u0631\u0627\u0628\u0637 \u062e\u0631\u0627\u0626\u0637 \u062c\u0648\u062c\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
          }
        }

        // 4. Log location changes for audit trail
        const locationChanged = ['latitude', 'longitude', 'googleMapsUrl', 'locationSource', 'locationVisibility'].some(
          k => cleaned[k] !== undefined
        );
        if (locationChanged) {
          console.log(`[Location] Property ${id} update: source=${cleaned.locationSource || 'unchanged'}, visibility=${cleaned.locationVisibility || 'unchanged'}, lat=${cleaned.latitude || 'unchanged'}, lng=${cleaned.longitude || 'unchanged'}`);
        }

        await db.updateProperty(id, cleaned as any);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    bookings: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        const bookingsList = await db.getAllBookings(input.limit, input.offset);
        // Enrich with ledger info and payment config
        let paymentConfigured = false;
        try {
          const { isPaymentConfigured } = await import('../finance-registry.js');
          const pc = await isPaymentConfigured();
          paymentConfigured = pc.configured;
        } catch { /* ignore */ }
        const enriched = await Promise.all(bookingsList.map(async (b: any) => {
          let ledgerEntries: any[] = [];
          try {
            const { getLedgerByBookingId } = await import('../finance-registry.js');
            ledgerEntries = await getLedgerByBookingId(b.id);
          } catch { /* ignore */ }
          return { ...b, ledgerEntries, paymentConfigured };
        }));
        return enriched;
      }),

    approveBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ id: z.number(), landlordNotes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending bookings can be approved' });
        // TRANSACTION: booking update + payment creation must be atomic
        const paymentId = await withTransaction(async () => {
          await db.updateBooking(input.id, { status: 'approved', landlordNotes: input.landlordNotes });
          const pid = await db.createPayment({
            bookingId: input.id,
            tenantId: booking.tenantId,
            landlordId: booking.landlordId,
            type: 'rent',
            amount: String(booking.totalAmount),
            status: 'pending',
            description: `Payment for booking #${input.id}`,
            descriptionAr: `دفعة الحجز رقم #${input.id}`,
          });
          return pid;
        });
        // Notify tenant: booking approved + bill ready (outside tx — best-effort)
        await db.createNotification({
          userId: booking.tenantId,
          type: 'booking_approved',
          titleEn: 'Booking Approved - Payment Required',
          titleAr: 'تم قبول الحجز - يرجى الدفع',
          contentEn: `Your booking #${input.id} has been approved. Please proceed to payment to confirm your reservation.`,
          contentAr: `تم قبول حجزك رقم #${input.id}. يرجى إتمام الدفع لتأكيد الحجز.`,
          relatedId: input.id,
          relatedType: 'booking',
        });
        // Email notification
        try {
          const tenant = await db.getUserById(booking.tenantId);
          const prop = await db.getPropertyById(booking.propertyId);
          if (tenant?.email && prop) {
            await sendBookingConfirmation({
              tenantEmail: tenant.email,
              tenantName: tenant.displayName || tenant.name || '',
              propertyTitle: prop.titleAr || prop.titleEn,
              checkIn: String(booking.moveInDate),
              checkOut: String(booking.moveOutDate),
              totalAmount: Number(booking.totalAmount),
              bookingId: input.id,
            });
          }
        } catch { /* email is best-effort */ }
        await notifyOwner({ title: `تم قبول الحجز #${input.id}`, content: `تم قبول الحجز وإرسال الفاتورة للمستأجر` });
        return { success: true, paymentId };
      }),

    rejectBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ id: z.number(), rejectionReason: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending bookings can be rejected' });
        await db.updateBooking(input.id, { status: 'rejected', rejectionReason: input.rejectionReason });
        // VOID all DUE ledger entries for this booking
        try {
          const { voidLedgerByBookingId } = await import('../finance-registry.js');
          const voided = await voidLedgerByBookingId(input.id, input.rejectionReason);
          console.log(`[Ledger] Voided ${voided} entries for rejected booking #${input.id}`);
        } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to void entries on rejection', error: (e as Error).message }) + '\n'); }
        // Cancel availability block if one exists
        try {
          const { cancelBookingBlock } = await import('../availability-blocks.js');
          await cancelBookingBlock(input.id, `Rejected: ${input.rejectionReason}`);
        } catch { /* block may not exist for pending bookings */ }
        // Outbound Beds24 sync: cancel in Beds24 if applicable
        try {
          const { cancelBookingInBeds24 } = await import('../beds24-sync.js');
          await cancelBookingInBeds24(input.id);
        } catch { /* best effort */ }
        await db.createNotification({
          userId: booking.tenantId,
          type: 'booking_rejected',
          titleEn: 'Booking Rejected',
          titleAr: 'تم رفض الحجز',
          contentEn: `Your booking #${input.id} has been rejected. Reason: ${input.rejectionReason}`,
          contentAr: `تم رفض حجزك رقم #${input.id}. السبب: ${input.rejectionReason}`,
          relatedId: input.id,
          relatedType: 'booking',
        });
        await notifyOwner({ title: `تم رفض الحجز #${input.id}`, content: `السبب: ${input.rejectionReason}` });
        return { success: true };
      }),

    // ── Reopen Booking (rejected/cancelled → pending or approved) ────
    reopenBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({
        id: z.number(),
        targetStatus: z.enum(['pending', 'approved']),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (!['rejected', 'cancelled'].includes(booking.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Cannot reopen a booking with status "${booking.status}". Only rejected or cancelled bookings can be reopened.` });
        }
        // Update booking status
        await db.updateBooking(input.id, {
          status: input.targetStatus,
          landlordNotes: input.adminNotes ? `${booking.landlordNotes || ''}\n[Reopened] ${input.adminNotes}` : booking.landlordNotes,
          rejectionReason: null as any,
        });
        // Un-void DUE/PENDING ledger entries (restore them from VOID back to DUE)
        try {
          const { getPool } = await import('../finance-registry.js');
          const pool = getPool();
          if (pool) {
            await pool.execute(
              `UPDATE payment_ledger SET status = 'DUE', notes = CONCAT(COALESCE(notes,''), '\n[Reopened by admin]') WHERE bookingId = ? AND status = 'VOID'`,
              [input.id]
            );
          }
        } catch { /* ledger restore is best-effort */ }
        // Re-create availability block if moving to approved
        if (input.targetStatus === 'approved') {
          try {
            const { createBookingBlock } = await import('../availability-blocks.js');
            const prop = await db.getPropertyById(booking.propertyId);
            await createBookingBlock({
              propertyId: booking.propertyId,
              unitId: (booking as any).unitId || undefined,
              bookingId: input.id,
              startDate: new Date(booking.moveInDate).toISOString().split('T')[0],
              endDate: new Date(booking.moveOutDate).toISOString().split('T')[0],
            });
          } catch { /* block creation is best-effort */ }
          // Create payment record if approving directly
          try {
            await db.createPayment({
              bookingId: input.id,
              tenantId: booking.tenantId,
              landlordId: booking.landlordId,
              type: 'rent',
              amount: String(booking.totalAmount),
              status: 'pending',
              description: `Payment for booking #${input.id} (reopened)`,
              descriptionAr: `دفعة الحجز رقم #${input.id} (أعيد فتحه)`,
            });
          } catch { /* payment creation is best-effort */ }
        }
        // Notify tenant
        await db.createNotification({
          userId: booking.tenantId,
          type: 'booking_approved',
          titleEn: input.targetStatus === 'approved' ? 'Booking Reopened & Approved' : 'Booking Reopened',
          titleAr: input.targetStatus === 'approved' ? 'تم إعادة فتح الحجز والموافقة عليه' : 'تم إعادة فتح الحجز',
          contentEn: `Your booking #${input.id} has been reopened by admin.`,
          contentAr: `تم إعادة فتح حجزك رقم #${input.id} بواسطة المسؤول.`,
          relatedId: input.id,
          relatedType: 'booking',
        });
        // Audit log
        try {
          const { logAudit } = await import('../audit-log.js');
          await logAudit({
            userId: ctx.user?.id, userName: ctx.user?.name || ctx.user?.email || 'admin',
            action: 'UPDATE', entityType: 'BOOKING', entityId: input.id,
            entityLabel: `Booking #${input.id}`,
            metadata: { previousStatus: booking.status, newStatus: input.targetStatus, adminNotes: input.adminNotes },
          });
        } catch { /* audit is best-effort */ }
        await notifyOwner({ title: `تم إعادة فتح الحجز #${input.id}`, content: `الحالة الجديدة: ${input.targetStatus}${input.adminNotes ? `\nملاحظات: ${input.adminNotes}` : ''}` });
        return { success: true };
      }),

    // ── Calculate Refund (read-only, no side effects) ────────────────
    calculateRefund: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        // Get all PAID ledger entries for this booking
        let ledgerEntries: any[] = [];
        try {
          const { getLedgerByBookingId } = await import('../finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(input.bookingId);
        } catch { /* no ledger */ }
        const paidEntries = ledgerEntries.filter((e: any) => e.status === 'PAID' && e.direction === 'IN');
        const totalPaid = paidEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        const refundedEntries = ledgerEntries.filter((e: any) => e.type === 'REFUND');
        const totalRefunded = refundedEntries.reduce((sum: number, e: any) => sum + Math.abs(Number(e.amount)), 0);
        // Calculate prorated refund based on days used
        const moveIn = new Date(booking.moveInDate);
        const moveOut = new Date(booking.moveOutDate);
        const now = new Date();
        const totalDays = Math.max(1, Math.ceil((moveOut.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24)));
        const daysUsed = now < moveIn ? 0 : Math.min(totalDays, Math.ceil((now.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24)));
        const daysRemaining = totalDays - daysUsed;
        const dailyRate = totalPaid / totalDays;
        const proratedRefund = Math.round(dailyRate * daysRemaining * 100) / 100;
        const maxRefundable = Math.max(0, totalPaid - totalRefunded);
        // Price breakdown from booking if available
        const breakdown = (booking as any).priceBreakdown || null;
        return {
          bookingId: input.bookingId,
          bookingStatus: booking.status,
          totalAmount: Number(booking.totalAmount),
          totalPaid,
          totalRefunded,
          maxRefundable,
          moveInDate: booking.moveInDate,
          moveOutDate: booking.moveOutDate,
          totalDays,
          daysUsed,
          daysRemaining,
          dailyRate: Math.round(dailyRate * 100) / 100,
          proratedRefund: Math.min(proratedRefund, maxRefundable),
          breakdown,
          paidEntries: paidEntries.map((e: any) => ({ id: e.id, invoiceNumber: e.invoiceNumber, amount: Number(e.amount), type: e.type, paidAt: e.paidAt })),
          refundedEntries: refundedEntries.map((e: any) => ({ id: e.id, invoiceNumber: e.invoiceNumber, amount: Number(e.amount), createdAt: e.createdAt })),
          currency: breakdown?.currency || 'SAR',
        };
      }),

    // ── Record Refund (manual — creates ledger entry only, no API call) ──
    recordRefund: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({
        bookingId: z.number(),
        amount: z.number().positive(),
        reason: z.string().min(5, 'Refund reason must be at least 5 characters'),
        refundMethod: z.enum(['bank_transfer', 'cash', 'original_payment_method']).default('bank_transfer'),
        cancelBooking: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        // Validate refund amount against max refundable
        let totalPaid = 0;
        let totalRefunded = 0;
        try {
          const { getLedgerByBookingId } = await import('../finance-registry.js');
          const entries = await getLedgerByBookingId(input.bookingId);
          totalPaid = entries.filter((e: any) => e.status === 'PAID' && e.direction === 'IN').reduce((s: number, e: any) => s + Number(e.amount), 0);
          totalRefunded = entries.filter((e: any) => e.type === 'REFUND').reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);
        } catch { /* ignore */ }
        const maxRefundable = totalPaid - totalRefunded;
        if (input.amount > maxRefundable + 0.01) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Refund amount (${input.amount}) exceeds max refundable (${maxRefundable.toFixed(2)})` });
        }
        // Create REFUND ledger entry (direction: OUT)
        let refundLedgerId: number | undefined;
        try {
          const { createLedgerEntry } = await import('../finance-registry.js');
          refundLedgerId = await createLedgerEntry({
            bookingId: input.bookingId,
            unitId: (booking as any).unitId || undefined,
            unitNumber: undefined,
            buildingId: (booking as any).buildingId || undefined,
            propertyDisplayName: undefined,
            type: 'REFUND',
            direction: 'OUT',
            amount: String(input.amount),
            currency: (booking as any).priceBreakdown?.currency || 'SAR',
            status: 'PAID',
            paymentMethod: input.refundMethod === 'original_payment_method' ? undefined : (input.refundMethod === 'bank_transfer' ? 'BANK_TRANSFER' : 'CASH') as any,
            provider: 'manual' as any,
            paidAt: new Date(),
            dueAt: new Date(),
            createdBy: ctx.user?.id,
            notes: `REFUND: ${input.reason} (recorded by ${ctx.user?.name || ctx.user?.email || 'admin'})`,
          });
        } catch (e) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create refund ledger entry: ${(e as Error).message}` });
        }
        // Optionally cancel the booking
        if (input.cancelBooking) {
          await db.updateBooking(input.bookingId, { status: 'cancelled' });
          try {
            const { cancelBookingBlock } = await import('../availability-blocks.js');
            await cancelBookingBlock(input.bookingId, `Refund processed: ${input.reason}`);
          } catch { /* best-effort */ }
        }
        // Audit log
        try {
          const { logAudit } = await import('../audit-log.js');
          await logAudit({
            userId: ctx.user?.id, userName: ctx.user?.name || ctx.user?.email || 'admin',
            action: 'CREATE', entityType: 'PAYMENT', entityId: refundLedgerId || input.bookingId,
            entityLabel: `Refund for Booking #${input.bookingId}`,
            metadata: { amount: input.amount, reason: input.reason, method: input.refundMethod, cancelBooking: input.cancelBooking },
          });
        } catch { /* audit is best-effort */ }
        // Notify tenant
        await db.createNotification({
          userId: booking.tenantId,
          type: 'booking_approved',
          titleEn: 'Refund Processed',
          titleAr: 'تم معالجة الاسترداد',
          contentEn: `A refund of ${input.amount} SAR has been recorded for booking #${input.bookingId}. The refund will be processed via ${input.refundMethod.replace('_', ' ')}.`,
          contentAr: `تم تسجيل استرداد بمبلغ ${input.amount} ر.س للحجز رقم #${input.bookingId}. سيتم معالجة الاسترداد عبر ${input.refundMethod === 'bank_transfer' ? 'تحويل بنكي' : input.refundMethod === 'cash' ? 'نقدي' : 'طريقة الدفع الأصلية'}.`,
          relatedId: input.bookingId,
          relatedType: 'booking',
        });
        await notifyOwner({ title: `تم تسجيل استرداد للحجز #${input.bookingId}`, content: `المبلغ: ${input.amount} ر.س\nالسبب: ${input.reason}\nالطريقة: ${input.refundMethod}` });
        return { success: true, refundLedgerId };
      }),

    // Check if payment override is enabled (for admin UI)
    isOverrideEnabled: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .query(async () => {
        const settings = await db.getAllSettings();
        return {
          enabled: settings['payment.enableOverride'] === 'true',
        };
      }),

    storageInfo: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        const { getStorageInfo } = await import('../storage');
        return getStorageInfo();
      }),

    confirmPayment: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS_OVERRIDE)
      .input(z.object({
        bookingId: z.number(),
        paymentMethod: z.enum(['paypal', 'cash', 'bank_transfer']).optional(),
        reason: z.string().min(10, 'Override reason must be at least 10 characters'),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check override flag is enabled
        const settings = await db.getAllSettings();
        if (settings['payment.enableOverride'] !== 'true') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Payment override is disabled. Enable it in Settings > Payment to use this feature.' });
        }
        
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only approved bookings can have payment confirmed' });
        
        // TRANSACTION: booking status + payment updates must be atomic
        await withTransaction(async () => {
          await db.updateBooking(input.bookingId, { status: 'active' });
          const bookingPayments = await db.getPaymentsByBooking(input.bookingId);
          for (const p of bookingPayments) {
            if (p.status === 'pending') {
              await db.updatePaymentStatus(p.id, 'completed', new Date());
              if (input.paymentMethod) {
                await db.updatePayment(p.id, { paymentMethod: input.paymentMethod });
              }
            }
          }
        });
        // Mark ledger entries as PAID
        let ledgerIds: number[] = [];
        try {
          const { getLedgerByBookingId, updateLedgerStatusSafe } = await import('../finance-registry.js');
          const ledgerEntries = await getLedgerByBookingId(input.bookingId);
          for (const le of ledgerEntries) {
            if (le.status === 'DUE' || le.status === 'PENDING') {
              await updateLedgerStatusSafe(le.id, 'PAID', {
                paymentMethod: (input.paymentMethod === 'cash' ? 'CASH' : input.paymentMethod === 'bank_transfer' ? 'BANK_TRANSFER' : undefined) as any,
                provider: 'manual_override',
                webhookVerified: true, // admin-confirmed = trusted
              });
              ledgerIds.push(le.id);
            }
          }
        } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to mark ledger PAID on payment confirmation', error: (e as Error).message }) + '\n'); }
        
        // ── AUDIT LOG: Record the manual override ──
        try {
          const { logAudit } = await import('../audit-log.js');
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || ctx.user.name || 'Admin',
            action: 'UPDATE',
            entityType: 'LEDGER',
            entityId: input.bookingId,
            entityLabel: `Manual payment override for booking #${input.bookingId}`,
            changes: {
              bookingStatus: { old: 'approved', new: 'active' },
              ledgerStatus: { old: 'DUE', new: 'PAID' },
              overrideReason: { old: null, new: input.reason },
            },
            metadata: {
              overrideType: 'manual_payment_confirmation',
              bookingId: input.bookingId,
              ledgerIds,
              paymentMethod: input.paymentMethod || 'unspecified',
              reason: input.reason,
              notes: input.notes || null,
            },
          });
        } catch (e) { console.error('[Audit] Failed to log payment override', e); }
        
        // ── Create availability block for occupancy tracking ──
        try {
          const { createBookingBlock } = await import('../availability-blocks.js');
          const startDate = booking.moveInDate ? new Date(booking.moveInDate).toISOString().split('T')[0] : null;
          const endDate = booking.moveOutDate ? new Date(booking.moveOutDate).toISOString().split('T')[0] : null;
          if (startDate && endDate) {
            await createBookingBlock({
              propertyId: booking.propertyId,
              unitId: (booking as any).unitId || undefined,
              bookingId: input.bookingId,
              startDate,
              endDate,
              source: 'LOCAL',
            });
          }
        } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'availability', msg: 'Failed to create availability block', error: (e as Error).message }) + '\n'); }
        
        // ── Outbound Beds24 sync: push booking to Beds24 if unit is LOCAL-controlled ──
        try {
          const { pushBookingToBeds24 } = await import('../beds24-sync.js');
          await pushBookingToBeds24(input.bookingId);
        } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'beds24-sync', msg: 'Failed to push booking to Beds24', error: (e as Error).message }) + '\n'); }
        
        // Notify tenant: payment confirmed (outside tx — best-effort)
        await db.createNotification({
          userId: booking.tenantId,
          type: 'payment_received',
          titleEn: 'Payment Confirmed - Booking Active',
          titleAr: 'تم تأكيد الدفع - الحجز نشط الآن',
          contentEn: `Payment for booking #${input.bookingId} has been confirmed (admin override). Your booking is now active!`,
          contentAr: `تم تأكيد دفعة الحجز رقم #${input.bookingId} (تأكيد يدوي). حجزك نشط الآن!`,
          relatedId: input.bookingId,
          relatedType: 'booking',
        });
        // Send payment receipt email
        try {
          const tenant = await db.getUserById(booking.tenantId);
          if (tenant?.email) {
            await sendPaymentReceipt({
              tenantEmail: tenant.email,
              tenantName: tenant.displayName || tenant.name || '',
              amount: Number(booking.totalAmount),
              bookingId: input.bookingId,
              paymentMethod: input.paymentMethod || 'cash',
            });
          }
        } catch { /* email is best-effort */ }
        await notifyOwner({ title: `⚠️ تأكيد دفع يدوي للحجز #${input.bookingId}`, content: `السبب: ${input.reason}` });
        return { success: true, overrideLogged: true };
      }),

    sendBillReminder: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only send reminders for approved bookings awaiting payment' });
        await db.createNotification({
          userId: booking.tenantId,
          type: 'payment_due',
          titleEn: 'Payment Reminder',
          titleAr: 'تذكير بالدفع',
          contentEn: `Reminder: Your booking #${input.bookingId} is awaiting payment. Total: ${booking.totalAmount} SAR.`,
          contentAr: `تذكير: حجزك رقم #${input.bookingId} بانتظار الدفع. المبلغ: ${booking.totalAmount} ريال.`,
          relatedId: input.bookingId,
          relatedType: 'booking',
        });
        return { success: true };
      }),

    allPayments: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllPayments(input.limit, input.offset);
      }),

    analytics: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ months: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const months = input?.months ?? 12;
        // Import source breakdown (best-effort)
        let bookingSourceBreakdown = { local: 0, beds24: 0, ical: 0, total: 0 };
        try {
          const { getBookingSourceBreakdown } = await import('../beds24-sync.js');
          bookingSourceBreakdown = await getBookingSourceBreakdown(months * 30);
        } catch { /* beds24-sync not available */ }
        const [
          bookingsByMonth, revenueByMonth, userRegistrations,
          propertiesByType, propertiesByCity, bookingStatusDist,
          revenueByMethod, topProperties, serviceRequests,
          maintenanceSummary, occupancy, recentActivity
        ] = await Promise.all([
          db.getBookingsByMonth(months),
          db.getRevenueByMonth(months),
          db.getUserRegistrationsByMonth(months),
          db.getPropertiesByType(),
          db.getPropertiesByCity(),
          db.getBookingStatusDistribution(),
          db.getRevenueByPaymentMethod(),
          db.getTopProperties(10),
          db.getServiceRequestsSummary(),
          db.getMaintenanceSummary(),
          db.getOccupancyRate(),
          db.getRecentActivity(20),
        ]);
        return {
          bookingsByMonth, revenueByMonth, userRegistrations,
          propertiesByType, propertiesByCity, bookingStatusDist,
          revenueByMethod, topProperties, serviceRequests,
          maintenanceSummary, occupancy, recentActivity,
          bookingSourceBreakdown,
        };
      }),
  }),

};
