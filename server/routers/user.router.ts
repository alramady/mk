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

// Domain: user
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const userRouterDefs = {
  favorite: router({
    toggle: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const exists = await db.isFavorite(ctx.user.id, input.propertyId);
        if (exists) {
          await db.removeFavorite(ctx.user.id, input.propertyId);
          return { isFavorite: false };
        } else {
          await db.addFavorite(ctx.user.id, input.propertyId);
          return { isFavorite: true };
        }
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserFavorites(ctx.user.id);
    }),
    check: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return { isFavorite: await db.isFavorite(ctx.user.id, input.propertyId) };
      }),
  }),

  savedSearch: router({
    create: protectedProcedure
      .input(z.object({ name: z.string(), filters: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createSavedSearch(ctx.user.id, input.name, input.filters);
        return { id };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getSavedSearches(ctx.user.id);
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership before delete
        const searches = await db.getSavedSearches(ctx.user.id);
        const owns = searches.some((s: any) => s.id === input.id);
        if (!owns) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.deleteSavedSearch(input.id);
        return { success: true };
      }),
  }),

  hidden: router({
    toggle: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const isHidden = await db.isPropertyHidden(ctx.user.id, input.propertyId);
        if (isHidden) {
          await db.unhideProperty(ctx.user.id, input.propertyId);
          return { isHidden: false };
        } else {
          await db.hideProperty(ctx.user.id, input.propertyId);
          return { isHidden: true };
        }
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserHiddenProperties(ctx.user.id);
    }),
    check: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return { isHidden: await db.isPropertyHidden(ctx.user.id, input.propertyId) };
      }),
  }),

  enquiry: router({
    create: protectedProcedure
      .input(z.object({ propertyId: z.number(), message: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createPropertyEnquiry(ctx.user.id, input.propertyId, input.message);
        return { success: true, id };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserEnquiries(ctx.user.id);
    }),
  }),

  review: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        bookingId: z.number().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        commentAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createReview({ ...input, tenantId: ctx.user.id });
        return { id };
      }),
  }),

  reviews: router({
    byProperty: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const [reviews, rating] = await Promise.all([
          db.getReviewsByProperty(input.propertyId),
          db.getPropertyAverageRating(input.propertyId),
        ]);
        return { reviews, averageRating: rating.average, reviewCount: rating.count };
      }),

    submit: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        bookingId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        commentAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify booking belongs to user and is completed
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        if (booking.status !== "completed") throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only review completed stays' });
        // Check if already reviewed
        const alreadyReviewed = await db.hasUserReviewedBooking(ctx.user.id, input.bookingId);
        if (alreadyReviewed) throw new TRPCError({ code: 'CONFLICT', message: 'Already reviewed this booking' });
        const id = await db.createReview({
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          bookingId: input.bookingId,
          rating: input.rating,
          comment: input.comment,
          commentAr: input.commentAr,
        });
        return { success: true, id };
      }),

    myReviews: protectedProcedure.query(async ({ ctx }) => {
      return db.getReviewsByTenant(ctx.user.id);
    }),

    canReview: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking || booking.tenantId !== ctx.user.id || booking.status !== "completed") return { canReview: false };
        const alreadyReviewed = await db.hasUserReviewedBooking(ctx.user.id, input.bookingId);
        return { canReview: !alreadyReviewed };
      }),

    // Admin
    all: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllReviews(input?.limit, input?.offset);
      }),

    togglePublished: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number(), isPublished: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.updateReviewPublished(input.id, input.isPublished);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReview(input.id);
        return { success: true };
      }),
   }),

  upload: router({
    file: protectedProcedure
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!validateContentType(input.contentType)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type' });
        const ext = input.filename.split('.').pop() || 'bin';
        const key = `uploads/${ctx.user.id}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
    // Property photo upload with optimization (called from AdminPropertyEdit)
    propertyPhoto: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ propertyId: z.number(), photo: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255) }))
      .mutation(async ({ ctx, input }) => {
        // Extract base64 data and content type from data URL
        let base64 = input.photo;
        let contentType = 'image/jpeg';
        const match = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contentType = match[1];
          base64 = match[2];
        }
        if (!validateContentType(contentType, ALLOWED_IMAGE_TYPES)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type. Only images allowed.' });
        }
        const buffer = Buffer.from(base64, 'base64');
        const basePath = `properties/${input.propertyId}`;
        try {
          const optimized = await optimizeImage(buffer, basePath, input.filename);
          return {
            url: optimized.original.url,
            thumbnail: optimized.thumbnail?.url,
            medium: optimized.medium?.url,
            variants: optimized,
          };
        } catch (err) {
          console.error('[upload.propertyPhoto] Optimization failed, uploading original:', err);
          const ext = input.filename.split('.').pop() || 'jpg';
          const key = `${basePath}/${nanoid()}.${ext}`;
          const { url } = await storagePut(key, buffer, contentType);
          return { url };
        }
      }),
  }),

};
