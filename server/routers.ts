import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS, PERMISSION_CATEGORIES, clearPermissionCache } from "./permissions";
import { z } from "zod";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";
import { cache, cacheThrough, CACHE_TTL, CACHE_KEYS } from "./cache";
import { rateLimiter, RATE_LIMITS, getClientIP } from "./rate-limiter";
import { getAiResponse, seedDefaultKnowledgeBase } from "./ai-assistant";
import { optimizeImage, optimizeAvatar } from "./image-optimizer";
import { generateLeaseContractHTML } from "./lease-contract";
import { createPayPalOrder, capturePayPalOrder, getPayPalSettings } from "./paypal";
import { notifyOwner } from "./_core/notification";
import { sendBookingConfirmation, sendPaymentReceipt, sendMaintenanceUpdate, sendNewMaintenanceAlert, verifySmtpConnection, isSmtpConfigured } from "./email";
import { savePushSubscription, removePushSubscription, sendPushToUser, sendPushBroadcast, isPushConfigured, getUserSubscriptionCount } from "./push";
import { roles as rolesTable, aiMessages as aiMessagesTable } from "../drizzle/schema";
import { drizzle } from "drizzle-orm/mysql2";
import { eq as eqDrizzle } from "drizzle-orm";
import { sanitizeText, sanitizeObject, validateContentType, validateFileExtension, MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_UPLOAD_TYPES, capLimit, capOffset, isOwnerOrAdmin, isBookingParticipant } from "./security";

// Shared drizzle instance for roles/aiStats (avoid creating new connections per request)
const sharedDb = drizzle(process.env.DATABASE_URL!);

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        nameAr: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        nationalId: z.string().optional(),
        nationality: z.string().optional(),
        nationalityAr: z.string().optional(),
        dateOfBirth: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyContactName: z.string().optional(),
        idDocumentUrl: z.string().optional(),
        avatarUrl: z.string().optional(),
        bio: z.string().optional(),
        bioAr: z.string().optional(),
        preferredLang: z.enum(["ar", "en"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profileData: any = { ...input };
        if (input.dateOfBirth) profileData.dateOfBirth = new Date(input.dateOfBirth);
        // Calculate profile completion
        const fields = ['name','phone','whatsapp','nationalId','nationality','address','emergencyContact','avatarUrl'];
        const user = await db.getUserById(ctx.user.id);
        const merged = { ...user, ...profileData };
        const filled = fields.filter(f => !!(merged as any)[f]).length;
        profileData.profileCompletionPct = Math.round((filled / fields.length) * 100);
        await db.updateUserProfile(ctx.user.id, profileData);
        return { success: true };
      }),
    getFullProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserById(ctx.user.id);
    }),
    switchRole: protectedProcedure
      .input(z.object({ role: z.enum(["tenant", "landlord"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

  // Properties
  property: router({
    create: protectedProcedure
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
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        floor: z.number().optional(),
        totalFloors: z.number().optional(),
        yearBuilt: z.number().optional(),
        furnishedLevel: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).optional(),
        monthlyRent: z.string(),
        securityDeposit: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        houseRules: z.string().optional(),
        houseRulesAr: z.string().optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        instantBook: z.boolean().optional(),
        photos: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProperty({ ...input, landlordId: ctx.user.id, status: "pending" } as any);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { id };
      }),

    update: protectedProcedure
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
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        floor: z.number().optional(),
        totalFloors: z.number().optional(),
        yearBuilt: z.number().optional(),
        furnishedLevel: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).optional(),
        monthlyRent: z.string().optional(),
        securityDeposit: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        houseRules: z.string().optional(),
        houseRulesAr: z.string().optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        instantBook: z.boolean().optional(),
        photos: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const prop = await db.getPropertyById(id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.updateProperty(id, data as any);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.deleteProperty(input.id);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) return null;
        await db.incrementPropertyViews(input.id);
        const manager = await db.getPropertyManagerByProperty(input.id);
        return { ...prop, manager: manager ?? null };
      }),

    getByLandlord: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getPropertiesByLandlord(ctx.user.id);
      }),

    search: publicProcedure
      .input(z.object({
        query: z.string().max(200).optional(),
        city: z.string().optional(),
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        furnishedLevel: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Rate limit public search
        const ip = getClientIP(ctx.req);
        const rl = rateLimiter.check(`search:${ip}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs);
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' });
        // Cache search results by input hash
        const hash = JSON.stringify(input);
        return cacheThrough(CACHE_KEYS.searchResults(hash), CACHE_TTL.SEARCH_RESULTS, () => db.searchProperties(input));
      }),

    featured: publicProcedure
      .query(async () => {
        return cacheThrough('property:featured', CACHE_TTL.HOMEPAGE_DATA, async () => {
          const result = await db.searchProperties({ limit: 6 });
          return result.items;
        });
      }),

    mapData: publicProcedure
      .input(z.object({
        city: z.string().optional(),
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        furnishedLevel: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const ip = getClientIP(ctx.req);
        const rl = rateLimiter.check(`map:${ip}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs);
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded.' });
        const hash = JSON.stringify(input || {});
        return cacheThrough(`map:data:${hash}`, CACHE_TTL.SEARCH_RESULTS, () => db.getMapProperties(input || undefined));
      }),

    uploadPhoto: protectedProcedure
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type. Only images allowed.' });
        const buffer = Buffer.from(input.base64, 'base64');
        const basePath = `properties/${ctx.user.id}`;
        try {
          const optimized = await optimizeImage(buffer, basePath, input.filename);
          return {
            url: optimized.original.url,
            thumbnail: optimized.thumbnail.url,
            medium: optimized.medium.url,
            variants: optimized,
          };
        } catch (err) {
          // Fallback to original upload if optimization fails
          console.error('[UploadPhoto] Optimization failed, uploading original:', err);
          const ext = input.filename.split('.').pop() || 'jpg';
          const key = `${basePath}/${nanoid()}.${ext}`;
          const { url } = await storagePut(key, buffer, input.contentType);
          return { url };
        }
      }),

    getAvailability: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return db.getPropertyAvailability(input.propertyId);
      }),

    setAvailability: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        isBlocked: z.boolean().optional(),
        priceOverride: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (!isOwnerOrAdmin(ctx.user, prop.landlordId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.setPropertyAvailability({
          ...input,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        });
        return { success: true };
      }),

    getReviews: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const reviews = await db.getReviewsByProperty(input.propertyId);
        const avgRating = await db.getAverageRating(input.propertyId);
        return { reviews, avgRating };
      }),
  }),

  // Favorites
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

  // Bookings
  booking: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        moveInDate: z.string(),
        moveOutDate: z.string(),
        durationMonths: z.number(),
        tenantNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        // Dynamic rental duration validation from settings
        const minMonths = parseInt(await db.getSetting("rental.minMonths") || "1");
        const maxMonths = parseInt(await db.getSetting("rental.maxMonths") || "2");
        if (input.durationMonths < minMonths || input.durationMonths > maxMonths) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Duration must be between ${minMonths} and ${maxMonths} months` });
        }
        const totalAmount = Number(prop.monthlyRent) * input.durationMonths;
        const id = await db.createBooking({
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          landlordId: prop.landlordId,
          status: prop.instantBook ? "approved" : "pending",
          moveInDate: new Date(input.moveInDate),
          moveOutDate: new Date(input.moveOutDate),
          durationMonths: input.durationMonths,
          monthlyRent: prop.monthlyRent,
          securityDeposit: prop.securityDeposit,
          totalAmount: String(totalAmount),
          tenantNotes: input.tenantNotes,
        });
        // Create notification for landlord
        await db.createNotification({
          userId: prop.landlordId,
          type: "booking_request",
          titleEn: "New Booking Request",
          titleAr: "طلب حجز جديد",
          contentEn: `A new booking request for ${prop.titleEn}`,
          contentAr: `طلب حجز جديد لـ ${prop.titleAr}`,
          relatedId: id ?? undefined,
          relatedType: "booking",
        });
        // Email notification to admin/owner
        try {
          await notifyOwner({
            title: `طلب حجز جديد - New Booking Request #${id}`,
            content: `طلب حجز جديد للعقار: ${prop.titleAr || prop.titleEn}\nالمستأجر: ${ctx.user.displayName || ctx.user.name}\nالمدة: ${input.durationMonths} شهر\nالمبلغ: ${totalAmount} ر.س\n\nNew booking for: ${prop.titleEn}\nTenant: ${ctx.user.displayName || ctx.user.name}\nDuration: ${input.durationMonths} month(s)\nTotal: SAR ${totalAmount}`,
          });
        } catch { /* notification delivery is best-effort */ }
        // Send booking confirmation email if instant book
        if (prop.instantBook) {
          try {
            const user = ctx.user;
            if (user.email) {
              await sendBookingConfirmation({
                tenantEmail: user.email,
                tenantName: user.displayName || user.name || "",
                propertyTitle: prop.titleAr || prop.titleEn,
                checkIn: input.moveInDate,
                checkOut: input.moveOutDate,
                totalAmount,
                bookingId: id!,
              });
            }
          } catch { /* email is best-effort */ }
        }
        return { id, status: prop.instantBook ? "approved" : "pending" };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected", "cancelled"]),
        rejectionReason: z.string().optional(),
        landlordNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.updateBooking(input.id, {
          status: input.status,
          rejectionReason: input.rejectionReason,
          landlordNotes: input.landlordNotes,
        });
        const notifType = input.status === "approved" ? "booking_approved" : "booking_rejected";
        await db.createNotification({
          userId: booking.tenantId,
          type: notifType,
          titleEn: input.status === "approved" ? "Booking Approved" : "Booking Rejected",
          titleAr: input.status === "approved" ? "تم قبول الحجز" : "تم رفض الحجز",
          relatedId: input.id,
          relatedType: "booking",
        });
        // Email notification to owner about status change
        try {
          const statusAr = input.status === "approved" ? "تم قبول الحجز" : input.status === "rejected" ? "تم رفض الحجز" : "تم إلغاء الحجز";
          await notifyOwner({
            title: `تحديث حالة الحجز #${input.id} - Booking Status Update`,
            content: `${statusAr}\nرقم الحجز: ${input.id}\n${input.rejectionReason ? `سبب الرفض: ${input.rejectionReason}` : ""}\n\nBooking #${input.id} status changed to: ${input.status}${input.rejectionReason ? `\nReason: ${input.rejectionReason}` : ""}`,
          });
        } catch { /* best-effort */ }
        // Send email to tenant about booking status change
        if (input.status === "approved") {
          try {
            const tenant = await db.getUserById(booking.tenantId);
            const prop = await db.getPropertyById(booking.propertyId);
            if (tenant?.email && prop) {
              await sendBookingConfirmation({
                tenantEmail: tenant.email,
                tenantName: tenant.displayName || tenant.name || "",
                propertyTitle: prop.titleAr || prop.titleEn,
                checkIn: String(booking.moveInDate),
                checkOut: String(booking.moveOutDate),
                totalAmount: Number(booking.totalAmount),
                bookingId: input.id,
              });
            }
          } catch { /* email is best-effort */ }
        }
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) return null;
        if (!isBookingParticipant(ctx.user, booking)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        return booking;
      }),

    myBookings: protectedProcedure.query(async ({ ctx }) => {
      return db.getBookingsByTenant(ctx.user.id);
    }),

    landlordBookings: protectedProcedure.query(async ({ ctx }) => {
      return db.getBookingsByLandlord(ctx.user.id);
    }),
  }),

  // Payments
  payment: router({
    create: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        type: z.enum(["rent", "deposit", "service_fee"]),
        amount: z.string(),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the tenant can create payments for this booking' });
        const id = await db.createPayment({
          bookingId: input.bookingId,
          tenantId: ctx.user.id,
          landlordId: booking.landlordId,
          type: input.type,
          amount: input.amount,
          status: "pending",
          description: input.description,
          descriptionAr: input.descriptionAr,
        });
        return { id };
      }),

    myPayments: protectedProcedure.query(async ({ ctx }) => {
      return db.getPaymentsByTenant(ctx.user.id);
    }),

    landlordPayments: protectedProcedure.query(async ({ ctx }) => {
      return db.getPaymentsByLandlord(ctx.user.id);
    }),

    byBooking: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input }) => {
        return db.getPaymentsByBooking(input.bookingId);
      }),
    // PayPal integration
    getPaymentSettings: publicProcedure.query(async () => {
      const settings = await getPayPalSettings();
      return {
        enabled: settings.enabled,
        cashEnabled: settings.cashEnabled,
        mode: settings.mode,
        currency: settings.currency,
        hasCredentials: !!(settings.clientId && settings.secret),
      };
    }),
    createPayPalOrder: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        amount: z.number().positive(),
        description: z.string(),
        origin: z.string(),
      }))
      .mutation(async ({ input }) => {
        const result = await createPayPalOrder({
          bookingId: input.bookingId,
          amount: input.amount,
          description: input.description,
          returnUrl: `${input.origin}/payment/success?bookingId=${input.bookingId}`,
          cancelUrl: `${input.origin}/payment/cancel?bookingId=${input.bookingId}`,
        });
        await db.updateBookingPayment(input.bookingId, {
          paypalOrderId: result.orderId,
          paymentStatus: "pending",
        });
        return result;
      }),
    capturePayPalOrder: protectedProcedure
      .input(z.object({
        orderId: z.string(),
        bookingId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const result = await capturePayPalOrder(input.orderId);
        if (result.status === "COMPLETED") {
          await db.updateBookingPayment(input.bookingId, {
            paypalOrderId: input.orderId,
            paypalCaptureId: result.captureId,
            paymentStatus: "paid",
            payerEmail: result.payerEmail,
            paidAmount: result.amount,
          });
        }
        return result;
      }),
  }),

  // Messages
  message: router({
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversationsByUser(ctx.user.id);
    }),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number(), limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        await db.markMessagesAsRead(input.conversationId, ctx.user.id);
        return db.getMessagesByConversation(input.conversationId, input.limit, input.offset);
      }),

    send: protectedProcedure
      .input(z.object({
        conversationId: z.number().optional(),
        recipientId: z.number().optional(),
        propertyId: z.number().optional(),
        content: z.string().min(1).max(5000),
        messageType: z.enum(["text", "image", "file"]).optional(),
        fileUrl: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const rl = rateLimiter.check(`msg:${ctx.user.id}`, 30, 60000); // 30 per min
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many messages. Please slow down.' });
        if (input.messageType === 'text') input.content = sanitizeText(input.content);
        let convId = input.conversationId;
        if (!convId && input.recipientId) {
          const conv = await db.getOrCreateConversation(ctx.user.id, input.recipientId, input.propertyId);
          convId = conv?.id;
        }
        if (!convId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        const id = await db.createMessage({
          conversationId: convId,
          senderId: ctx.user.id,
          content: input.content,
          messageType: input.messageType ?? "text",
          fileUrl: input.fileUrl,
        });
        // Notification for recipient
        const convs = await db.getConversationsByUser(ctx.user.id);
        const conv = convs.find(c => c.id === convId);
        if (conv) {
          const recipientId = conv.tenantId === ctx.user.id ? conv.landlordId : conv.tenantId;
          await db.createNotification({
            userId: recipientId,
            type: "message_new",
            titleEn: "New Message",
            titleAr: "رسالة جديدة",
            contentEn: input.content.substring(0, 100),
            relatedId: convId,
            relatedType: "conversation",
          });
        }
        return { id, conversationId: convId };
      }),

    startConversation: protectedProcedure
      .input(z.object({ recipientId: z.number(), propertyId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const conv = await db.getOrCreateConversation(ctx.user.id, input.recipientId, input.propertyId);
        return conv;
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadMessageCount(ctx.user.id) };
    }),
  }),

  // Maintenance
  maintenance: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        bookingId: z.number().optional(),
        title: z.string().min(1),
        titleAr: z.string().optional(),
        description: z.string().min(1),
        descriptionAr: z.string().optional(),
        category: z.enum(["plumbing", "electrical", "hvac", "appliance", "structural", "pest_control", "cleaning", "other"]).optional(),
        priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        const id = await db.createMaintenanceRequest({
          ...input,
          tenantId: ctx.user.id,
          landlordId: prop.landlordId,
          status: "submitted",
        });
        await db.createNotification({
          userId: prop.landlordId,
          type: "maintenance_update",
          titleEn: "New Maintenance Request",
          titleAr: "طلب صيانة جديد",
          contentEn: input.title,
          contentAr: input.titleAr,
          relatedId: id ?? undefined,
          relatedType: "maintenance",
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["acknowledged", "in_progress", "completed", "cancelled"]).optional(),
        landlordResponse: z.string().optional(),
        landlordResponseAr: z.string().optional(),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const req = await db.getMaintenanceById(id);
        if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        if (req.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        const updateData: any = { ...data };
        if (input.status === "completed") updateData.resolvedAt = new Date();
        await db.updateMaintenanceRequest(id, updateData);
        await db.createNotification({
          userId: req.tenantId,
          type: "maintenance_update",
          titleEn: `Maintenance Request Updated: ${input.status ?? "updated"}`,
          titleAr: `تحديث طلب الصيانة`,
          relatedId: id,
          relatedType: "maintenance",
        });
        return { success: true };
      }),

    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getMaintenanceByTenant(ctx.user.id);
    }),

    landlordRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getMaintenanceByLandlord(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const req = await db.getMaintenanceById(input.id);
        if (!req) return null;
        if (req.tenantId !== ctx.user.id && req.landlordId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        return req;
      }),
  }),

  // Notifications
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotificationsByUser(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify notification belongs to user
        const notifications = await db.getNotificationsByUser(ctx.user.id);
        const owns = notifications.some((n: any) => n.id === input.id);
        if (!owns) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.markNotificationRead(input.id);
        return { success: true };
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),
  }),

  // Reviews
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

  // Saved Searches
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

  // Admin
  admin: router({
    stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).query(async () => {
      const [userCount, propertyCount, activeProperties, pendingProperties, bookingCount, activeBookings, totalRevenue] = await Promise.all([
        db.getUserCount(),
        db.getPropertyCount(),
        db.getPropertyCount("active"),
        db.getPropertyCount("pending"),
        db.getBookingCount(),
        db.getBookingCount("active"),
        db.getTotalRevenue(),
      ]);
      return { userCount, propertyCount, activeProperties, pendingProperties, bookingCount, activeBookings, totalRevenue };
    }),

    users: adminWithPermission(PERMISSIONS.MANAGE_USERS)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllUsers(input.limit, input.offset);
      }),

    updateUserRole: adminWithPermission(PERMISSIONS.MANAGE_USERS)
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "landlord", "tenant"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    properties: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getAllProperties(input.limit, input.offset, input.status);
      }),

    approveProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number(), status: z.enum(["active", "rejected"]), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.updateProperty(input.id, { status: input.status });
        return { success: true };
      }),

    bookings: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllBookings(input.limit, input.offset);
      }),

    analytics: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ months: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const months = input?.months ?? 12;
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
        };
      }),
  }),

  // Site Settings (CMS)
  siteSettings: router({
    getAll: publicProcedure.query(async () => {
      return cacheThrough(CACHE_KEYS.settings(), CACHE_TTL.SETTINGS, () => db.getAllSettings());
    }),
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return { value: await cacheThrough(CACHE_KEYS.settingsSingle(input.key), CACHE_TTL.SETTINGS, () => db.getSetting(input.key)) };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ settings: z.record(z.string(), z.string()) }))
      .mutation(async ({ input }) => {
        await db.bulkSetSettings(input.settings);
        cache.invalidatePrefix('settings:');
        return { success: true };
      }),
    uploadAsset: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string(), purpose: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'png';
        const key = `site-assets/${input.purpose}-${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        await db.setSetting(input.purpose, url);
        return { url };
      }),
    seed: adminProcedure.mutation(async () => {
      const defaults: Record<string, string> = {
        "site.nameAr": "Monthly Key",
        "site.nameEn": "Monthly Key",
        "site.descriptionAr": "Monthly Key تربط المستأجرين بأفضل العقارات للإيجار الشهري في المملكة العربية السعودية",
        "site.descriptionEn": "Monthly Key connects tenants with the best monthly rental properties across Saudi Arabia",
        "site.logoUrl": "",
        "site.faviconUrl": "",
        "site.primaryColor": "#3ECFC0",
        "site.accentColor": "#C9A96E",
        "hero.titleAr": "خبير الإيجار الشهري — الآن في السعودية",
        "hero.titleEn": "Monthly Rental Expert — Now in Saudi Arabia",
        "hero.subtitleAr": "إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة",
        "hero.subtitleEn": "Premium monthly rental management | Riyadh • Jeddah • Madinah",
        "hero.bgImage": "",
        "stats.properties": "500+",
        "stats.propertiesLabelAr": "عقار متاح",
        "stats.propertiesLabelEn": "Available Properties",
        "stats.tenants": "1000+",
        "stats.tenantsLabelAr": "مستأجر سعيد",
        "stats.tenantsLabelEn": "Happy Tenants",
        "stats.cities": "50+",
        "stats.citiesLabelAr": "مدينة",
        "stats.citiesLabelEn": "Cities",
        "stats.satisfaction": "98%",
        "stats.satisfactionLabelAr": "رضا العملاء",
        "stats.satisfactionLabelEn": "Customer Satisfaction",
        "fees.serviceFeePercent": "5",
        "fees.minRent": "500",
        "fees.maxRent": "100000",
        "fees.depositPercent": "10",
        "fees.vatPercent": "15",
        "rental.minMonths": "1",
        "rental.maxMonths": "2",
        "rental.minMonthsLabelAr": "الحد الأدنى لمدة الإيجار (بالأشهر)",
        "rental.minMonthsLabelEn": "Minimum Rental Duration (months)",
        "rental.maxMonthsLabelAr": "الحد الأقصى لمدة الإيجار (بالأشهر)",
        "rental.maxMonthsLabelEn": "Maximum Rental Duration (months)",
        "footer.aboutAr": "Monthly Key هي المنصة الرائدة للإيجار الشهري في المملكة العربية السعودية. نقدم حلول إيجار مرنة لتسهيل تجربة السكن الشهري.",
        "footer.aboutEn": "Monthly Key is Saudi Arabia's leading monthly rental platform. We offer flexible rental solutions for a seamless monthly living experience.",
        "footer.email": "",
        "footer.phone": "",
        "footer.addressAr": "الرياض، المملكة العربية السعودية",
        "footer.addressEn": "Riyadh, Saudi Arabia",
        "footer.twitter": "",
        "footer.instagram": "",
        "footer.linkedin": "",
        "whatsapp.number": "966504466528",
        "whatsapp.message": "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري",
        "whatsapp.textAr": "تواصل معنا",
        "whatsapp.textEn": "Chat with us",
        "legal.tourismLicence": "٢٣٤٥٦٧٨٩٠١",
        "legal.crNumber": "",
        "legal.vatNumber": "",
        "legal.ejarLicence": "",
        "terms.contentAr": "",
        "terms.contentEn": "",
        "privacy.contentAr": "",
        "privacy.contentEn": "",
        "faq.items": "[]",
        "maintenance.enabled": "true",
        "maintenance.titleAr": "قريباً... الانطلاق",
        "maintenance.titleEn": "Coming Soon",
        "maintenance.subtitleAr": "نعمل على تجهيز تجربة مميزة لكم",
        "maintenance.subtitleEn": "We're preparing an exceptional experience for you",
        "maintenance.messageAr": "ستكون رحلة مميزة معنا في عالم الإيجارات الشهرية. ترقبونا!",
        "maintenance.messageEn": "An exceptional journey awaits you in the world of monthly rentals. Stay tuned!",
        "maintenance.imageUrl": "",
        "maintenance.countdownDate": "",
        "maintenance.showCountdown": "false",
        "social.twitter": "",
        "social.instagram": "",
        "social.snapchat": "",
        "social.tiktok": "",
        "social.linkedin": "",
        "social.youtube": "",
        "ai.enabled": "true",
        "ai.name": "المفتاح الشهري الذكي",
        "ai.nameEn": "Monthly Key AI",
        "ai.personality": "professional_friendly",
        "ai.welcomeMessage": "مرحباً! أنا المفتاح الشهري الذكي، كيف أقدر أساعدك؟",
        "ai.welcomeMessageEn": "Hello! I'm Monthly Key AI, how can I help you?",
        "ai.customInstructions": "",
        "ai.maxResponseLength": "800",
      };
      await db.bulkSetSettings(defaults);
      return { success: true };
    }),
  }),

  // AI Assistant
  ai: router({
    // Create or get conversations
    conversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getAiConversations(ctx.user.id);
    }),

    newConversation: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createAiConversation(ctx.user.id, input.title);
        return { id };
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiConversation(input.id);
        return { success: true };
      }),

    messages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        return db.getAiMessages(input.conversationId);
      }),

    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await db.createAiMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        });

        // Get AI response
        const response = await getAiResponse(
          ctx.user.id,
          input.conversationId,
          input.message,
          ctx.user.role,
        );

        // Save assistant message
        const msgId = await db.createAiMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: response,
        });

        return { response, messageId: msgId };
      }),

    rateMessage: protectedProcedure
      .input(z.object({ messageId: z.number(), rating: z.number().min(1).max(5) }))
      .mutation(async ({ input }) => {
        await db.rateAiMessage(input.messageId, input.rating);
        return { success: true };
      }),

    // Admin: AI stats
    stats: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiStats();
    }),

    // Admin: All conversations
    allConversations: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllAiConversations(input?.limit || 50, input?.offset || 0);
      }),

    // Admin: View any conversation messages
    adminMessages: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        return db.getAiMessages(input.conversationId);
      }),

    // Admin: Rated messages
    ratedMessages: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiRatedMessages();
    }),

    // Admin: Upload document to knowledge base
    uploadDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        base64: z.string().max(MAX_BASE64_SIZE),
        filename: z.string().max(255),
        contentType: z.string().max(100),
        category: z.string().optional(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split('.').pop() || 'pdf';
        const key = `ai-docs/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        const id = await db.createAiDocument({
          filename: input.filename,
          fileUrl: url,
          fileKey: key,
          mimeType: input.contentType,
          fileSize: buffer.length,
          extractedText: input.extractedText || null,
          category: input.category || "general",
          description: input.description || null,
          descriptionAr: input.descriptionAr || null,
          isActive: true,
          uploadedBy: ctx.user!.id,
        });
        return { id, url };
      }),

    // Admin: List documents
    documents: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiDocuments();
    }),

    // Admin: Update document
    updateDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        category: z.string().optional(),
        extractedText: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAiDocument(id, data as any);
        return { success: true };
      }),

    // Admin: Delete document
    deleteDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiDocument(input.id);
        return { success: true };
      }),
  }),

  // Knowledge Base
  knowledge: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getKnowledgeArticles(input?.category);
      }),

    all: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAllKnowledgeArticles();
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        category: z.enum(["general", "tenant_guide", "landlord_guide", "admin_guide", "faq", "policy", "troubleshooting"]),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        contentEn: z.string().min(1),
        contentAr: z.string().min(1),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createKnowledgeArticle(input);
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        id: z.number(),
        category: z.enum(["general", "tenant_guide", "landlord_guide", "admin_guide", "faq", "policy", "troubleshooting"]).optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateKnowledgeArticle(id, data as any);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteKnowledgeArticle(input.id);
        return { success: true };
      }),

    seed: adminProcedure.mutation(async () => {
      await seedDefaultKnowledgeBase();
      return { success: true };
    }),
  }),

  // Lease Contract
  lease: router({
    generate: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ input }) => {
        const { html, data } = await generateLeaseContractHTML(input.bookingId);
        return { html, contractNumber: data.contractNumber };
      }),
  }),

  // User Activity Tracking
  activity: router({
    track: publicProcedure
      .input(z.object({
        action: z.string(),
        page: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.trackActivity({
          userId: ctx.user?.id ?? null,
          action: input.action,
          page: input.page,
          metadata: input.metadata as Record<string, unknown>,
          ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString() || null,
          userAgent: ctx.req.headers['user-agent'] || null,
          sessionId: null,
        });
        return { success: true };
      }),

    stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).query(async () => {
      return db.getActivityStats();
    }),

    log: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({
        userId: z.number().optional(),
        action: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getActivityLog(input ?? undefined);
      }),

    userPreferences: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserPreferences(input.userId);
      }),
  }),

  // Admin Permissions
  permissions: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
      return db.getAllAdminPermissions();
    }),

    get: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getAdminPermissions(input.userId);
      }),

    set: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        userId: z.number(),
        permissions: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if target is root admin - cannot modify
        const existing = await db.getAdminPermissions(input.userId);
        if (existing?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify root admin permissions' });
        }
        await db.setAdminPermissions(input.userId, input.permissions);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const existing = await db.getAdminPermissions(input.userId);
        if (existing?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete root admin' });
        }
        await db.deleteAdminPermissions(input.userId);
        return { success: true };
      }),
  }),

  // Cities
  cities: router({
    all: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const activeOnly = input?.activeOnly ?? true;
        return cacheThrough(CACHE_KEYS.allCities(activeOnly), CACHE_TTL.CITY_LIST, () => db.getAllCities(activeOnly));
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCityById(input.id);
      }),

    count: publicProcedure.query(async () => {
      return { count: await db.getCityCount() };
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        nameEn: z.string(),
        nameAr: z.string(),
        region: z.string().optional(),
        regionAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCity(input as any);
        cache.invalidatePrefix('cities:');
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        region: z.string().optional(),
        regionAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCity(id, data as any);
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    toggle: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isActive: z.boolean(), isFeatured: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await db.toggleCityActive(input.id, input.isActive);
        if (input.isFeatured !== undefined) {
          await db.updateCity(input.id, { isFeatured: input.isFeatured });
        }
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    toggleFeatured: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isFeatured: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.updateCity(input.id, { isFeatured: input.isFeatured });
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    getFeatured: publicProcedure.query(async () => {
      return cacheThrough(CACHE_KEYS.featuredCities(), CACHE_TTL.CITY_LIST, () => db.getFeaturedCities());
    }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCity(input.id);
        cache.invalidatePrefix('cities:'); cache.invalidatePrefix('districts:');
        return { success: true };
      }),

    uploadPhoto: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `cities/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
  }),

  // Districts
  districts: router({
    all: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllDistricts(input?.activeOnly ?? true);
      }),

    byCity: publicProcedure
      .input(z.object({ city: z.string(), activeOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        return db.getDistrictsByCity(input.city, input.activeOnly ?? true);
      }),

    byCityId: publicProcedure
      .input(z.object({ cityId: z.number(), activeOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        return db.getDistrictsByCityId(input.cityId, input.activeOnly ?? true);
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getDistrictById(input.id);
      }),

    count: publicProcedure.query(async () => {
      return { count: await db.getDistrictCount() };
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        cityId: z.number().optional(),
        city: z.string(),
        cityAr: z.string(),
        nameEn: z.string(),
        nameAr: z.string(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createDistrict(input as any);
        cache.invalidatePrefix('districts:');
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        id: z.number(),
        cityId: z.number().optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDistrict(id, data as any);
        return { success: true };
      }),

    toggle: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.toggleDistrictActive(input.id, input.isActive);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDistrict(input.id);
        cache.invalidatePrefix('districts:');
        return { success: true };
      }),

    bulkCreate: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        districts: z.array(z.object({
          cityId: z.number().optional(),
          city: z.string(),
          cityAr: z.string(),
          nameEn: z.string(),
          nameAr: z.string(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.bulkCreateDistricts(input.districts as any[]);
        cache.invalidatePrefix('districts:');
        return { success: true, count: input.districts.length };
      }),

    deleteByCity: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ city: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteDistrictsByCity(input.city);
        cache.invalidatePrefix('districts:');
        return { success: true };
      }),
  }),

  // Property Managers
  propertyManager: router({
    list: publicProcedure.query(async () => {
      return await db.getAllPropertyManagers();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getPropertyManagerById(input.id);
    }),
    getByProperty: publicProcedure.input(z.object({ propertyId: z.number() })).query(async ({ input }) => {
      return await db.getPropertyManagerByProperty(input.propertyId);
    }),
    create: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        name: z.string().min(1), nameAr: z.string().min(1),
        phone: z.string().min(1), whatsapp: z.string().optional(),
        email: z.string().optional(), photoUrl: z.string().optional(),
        bio: z.string().optional(), bioAr: z.string().optional(),
        title: z.string().optional(), titleAr: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createPropertyManager(input as any);
        return { success: true, id };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        id: z.number(),
        name: z.string().optional(), nameAr: z.string().optional(),
        phone: z.string().optional(), whatsapp: z.string().optional(),
        email: z.string().optional(), photoUrl: z.string().optional(),
        bio: z.string().optional(), bioAr: z.string().optional(),
        title: z.string().optional(), titleAr: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePropertyManager(id, data as any);
        return { success: true };
      }),
    delete: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePropertyManager(input.id);
        return { success: true };
      }),
    assign: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number(), propertyIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await db.assignManagerToProperties(input.managerId, input.propertyIds);
        return { success: true };
      }),
    getAssignments: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getManagerAssignments(input.managerId);
      }),
    getWithProperties: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getManagerWithProperties(input.id);
      }),
    listWithCounts: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES).query(async () => {
      return await db.getAllManagersWithCounts();
    }),
    uploadPhoto: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `managers/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
    // Agent self-service: request edit link by email
    requestEditLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        // Rate limit to prevent email enumeration
        const ip = getClientIP(ctx.req);
        const rl = rateLimiter.check(`editlink:${ip}`, 5, 300000); // 5 per 5 min
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' });
        const manager = await db.getManagerByEmail(input.email);
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'No manager found with this email' });
        const token = nanoid(32);
        await db.setManagerEditToken(manager.id, token);
        // Token should be sent via email in production — not returned in response
        return { success: true, message: 'Edit link has been generated. Please check your email.' };
      }),
    // Agent self-service: get profile by edit token
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const manager = await db.getManagerByToken(input.token);
        if (!manager) return null;
        return manager;
      }),
    // Agent self-service: update own profile by token
    updateSelfProfile: publicProcedure
      .input(z.object({
        token: z.string(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        bio: z.string().optional(),
        bioAr: z.string().optional(),
        photoUrl: z.string().optional(),
        title: z.string().optional(),
        titleAr: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const manager = await db.getManagerByToken(input.token);
        if (!manager) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
        const { token, ...data } = input;
        const updateData: Record<string, any> = {};
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
        if (data.bio !== undefined) updateData.bio = data.bio;
        if (data.bioAr !== undefined) updateData.bioAr = data.bioAr;
        if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.titleAr !== undefined) updateData.titleAr = data.titleAr;
        await db.updatePropertyManager(manager.id, updateData);
        return { success: true };
      }),
    // Agent self-service: upload own photo by token
    uploadSelfPhoto: publicProcedure
      .input(z.object({ token: z.string(), base64: z.string().max(MAX_AVATAR_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ input }) => {
        if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type. Only images allowed.' });
        const manager = await db.getManagerByToken(input.token);
        if (!manager) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `managers/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        await db.updatePropertyManager(manager.id, { photoUrl: url });
        return { url };
      }),
    // Generate edit link for a manager (admin)
    generateEditLink: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number() }))
      .mutation(async ({ input }) => {
        const manager = await db.getPropertyManagerById(input.managerId);
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'Manager not found' });
        const token = nanoid(32);
        await db.setManagerEditToken(input.managerId, token);
        return { token };
      }),
  }),

  // Inspection Requests
  inspection: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        requestedDate: z.string(),
        requestedTimeSlot: z.string(),
        fullName: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const manager = await db.getPropertyManagerByProperty(input.propertyId);
        const id = await db.createInspectionRequest({
          ...input,
          userId: ctx.user.id,
          managerId: manager?.id || null,
          requestedDate: new Date(input.requestedDate),
        } as any);
        return { success: true, id };
      }),
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserInspectionRequests(ctx.user.id);
    }),
    listAll: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllInspectionRequests(input?.status);
      }),
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateInspectionStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),
    getTimeSlots: publicProcedure.query(async () => {
      const settings = await db.getAllSettings();
      const slotsStr = settings['inspection.timeSlots'];
      return slotsStr ? JSON.parse(slotsStr) : [
        "09:00-10:00", "10:00-11:00", "11:00-12:00",
        "14:00-15:00", "15:00-16:00", "16:00-17:00"
      ];
    }),
  }),

  // Contact Messages
  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        subject: z.string().min(3),
        message: z.string().min(10),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createContactMessage(input);
        // Notify owner about new contact message
        try {
          await notifyOwner({
            title: `رسالة تواصل جديدة - New Contact Message`,
            content: `الاسم: ${input.name}\nالبريد: ${input.email}\nالهاتف: ${input.phone || "غير محدد"}\nالموضوع: ${input.subject}\nالرسالة: ${input.message}\n\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone || "N/A"}\nSubject: ${input.subject}\nMessage: ${input.message}`,
          });
        } catch { /* best-effort */ }
        return { id, success: true };
      }),
    list: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return db.getContactMessages();
    }),
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ id: z.number(), status: z.enum(["read", "replied"]) }))
      .mutation(async ({ input }) => {
        await db.updateContactMessageStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ─── Platform Services ──────────────────────────────────────────────
  services: router({
    // Admin: list all services
    listAll: adminWithPermission(PERMISSIONS.MANAGE_SERVICES).query(async () => {
      return await db.getAllPlatformServices();
    }),
    // Public: list active services
    listActive: publicProcedure.query(async () => {
      return await db.getActivePlatformServices();
    }),
    // Admin: create service
    create: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        nameAr: z.string().min(1), nameEn: z.string().min(1),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string(), category: z.enum(["cleaning", "maintenance", "furniture", "moving", "other"]),
        icon: z.string().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createPlatformService(input as any);
      }),
    // Admin: update service
    update: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        id: z.number(),
        nameAr: z.string().optional(), nameEn: z.string().optional(),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string().optional(), category: z.enum(["cleaning", "maintenance", "furniture", "moving", "other"]).optional(),
        icon: z.string().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePlatformService(id, data as any);
        return { success: true };
      }),
    // Admin: delete service
    delete: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlatformService(input.id);
        return { success: true };
      }),
  }),

  // ─── Service Requests ───────────────────────────────────────────────
  serviceRequests: router({
    // Tenant: request a service
    create: protectedProcedure
      .input(z.object({
        serviceId: z.number(), bookingId: z.number().optional(),
        propertyId: z.number().optional(), notes: z.string().optional(),
        totalPrice: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createServiceRequest({ ...input, tenantId: ctx.user.id } as any);
        await notifyOwner({ title: "طلب خدمة جديد / New Service Request", content: `طلب خدمة جديد من المستأجر ${ctx.user.displayName || ctx.user.name}\nService #${input.serviceId} - ${input.totalPrice} SAR` });
        return result;
      }),
    // Tenant: my requests
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getServiceRequestsByTenant(ctx.user.id);
    }),
    // Admin: all requests
    listAll: adminWithPermission(PERMISSIONS.MANAGE_SERVICES).query(async () => {
      return await db.getAllServiceRequests();
    }),
    // Admin: update request status
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "approved", "in_progress", "completed", "cancelled"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateServiceRequest(input.id, { status: input.status, adminNotes: input.adminNotes } as any);
        return { success: true };
      }),
  }),

  // ─── Emergency Maintenance ──────────────────────────────────────────
  emergencyMaintenance: router({
    // Tenant: submit emergency request
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(), bookingId: z.number().optional(),
        urgency: z.enum(["low", "medium", "high", "critical"]),
        category: z.enum(["plumbing", "electrical", "ac_heating", "appliance", "structural", "pest", "security", "other"]),
        title: z.string().min(1), titleAr: z.string().optional(),
        description: z.string().min(1), descriptionAr: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createEmergencyMaintenance({ ...input, tenantId: ctx.user.id } as any);
        const urgencyLabel = { low: "منخفض", medium: "متوسط", high: "عالي", critical: "حرج" }[input.urgency];
        await notifyOwner({
          title: `🚨 طلب صيانة طوارئ - ${urgencyLabel} / Emergency Maintenance - ${input.urgency.toUpperCase()}`,
          content: `المستأجر: ${ctx.user.displayName || ctx.user.name}\nالعنوان: ${input.title}\nالأولوية: ${urgencyLabel}\nالتصنيف: ${input.category}\n\n${input.description}`,
        });
        // Send email alert to admins about new maintenance request
        try {
          const allUsers = await db.getAllUsers(100, 0);
          const admins = allUsers.filter((u: any) => u.role === 'admin');
          for (const admin of admins) {
            if (admin.email) {
              await sendNewMaintenanceAlert({
                adminEmail: admin.email,
                tenantName: ctx.user.displayName || ctx.user.name || "",
                ticketId: (result as any).insertId || 0,
                title: input.title,
                urgency: input.urgency,
                category: input.category,
                description: input.description,
                imageCount: input.imageUrls?.length || 0,
              });
            }
          }
        } catch { /* email is best-effort */ }
        return result;
      }),
    // Tenant: upload maintenance media (images/videos) to S3
    uploadMedia: protectedProcedure
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!validateContentType(input.contentType)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type' });
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `maintenance/${ctx.user.id}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
    // Tenant: my emergency requests
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEmergencyMaintenanceByTenant(ctx.user.id);
    }),
    // Admin: all emergency requests
    listAll: adminWithPermission(PERMISSIONS.MANAGE_MAINTENANCE).query(async () => {
      return await db.getAllEmergencyMaintenance();
    }),
    // Get single request with updates (owner or admin only)
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const ticket = await db.getEmergencyMaintenanceById(input.id);
        if (!ticket) return { ticket: null, updates: [] };
        if (ticket.tenantId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        const updates = await db.getMaintenanceUpdates(input.id);
        return { ticket, updates };
      }),
    // Admin: update status and add update message
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_MAINTENANCE)
      .input(z.object({
        id: z.number(),
        status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
        message: z.string().min(1), messageAr: z.string().optional(),
        assignedTo: z.string().optional(), assignedPhone: z.string().optional(),
        resolution: z.string().optional(), resolutionAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: any = { status: input.status };
        if (input.assignedTo) updateData.assignedTo = input.assignedTo;
        if (input.assignedPhone) updateData.assignedPhone = input.assignedPhone;
        if (input.resolution) updateData.resolution = input.resolution;
        if (input.resolutionAr) updateData.resolutionAr = input.resolutionAr;
        if (input.status === "closed" || input.status === "resolved") updateData.closedAt = new Date();
        await db.updateEmergencyMaintenance(input.id, updateData);
        await db.createMaintenanceUpdate({
          maintenanceId: input.id,
          message: input.message,
          messageAr: input.messageAr || undefined,
          updatedBy: ctx.user!.displayName || ctx.user!.name || "Admin",
          newStatus: input.status,
        } as any);
        // Notify owner about status change
        const statusLabels: Record<string, string> = { open: "مفتوح", assigned: "تم التعيين", in_progress: "قيد التنفيذ", resolved: "تم الحل", closed: "مغلق" };
        await notifyOwner({
          title: `تحديث صيانة #${input.id} - ${statusLabels[input.status]} / Maintenance Update`,
          content: `الحالة: ${statusLabels[input.status]}\n${input.message}`,
        });
        // Send email to tenant about maintenance update
        try {
          const ticket = await db.getEmergencyMaintenanceById(input.id);
          if (ticket) {
            const tenant = await db.getUserById(ticket.tenantId);
            if (tenant?.email) {
              await sendMaintenanceUpdate({
                tenantEmail: tenant.email,
                tenantName: tenant.displayName || tenant.name || "",
                ticketId: input.id,
                title: ticket.titleAr || ticket.title,
                status: input.status,
                message: input.messageAr || input.message,
              });
            }
          }
        } catch { /* email is best-effort */ }
        return { success: true };
      }),
  }),

  // ─── Email / SMTP ──────────────────────────────────────────────────
  email: router({
    // Admin: verify SMTP connection
    verifySmtp: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return await verifySmtpConnection();
    }),
    // Admin: check if SMTP is configured
    status: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return { configured: isSmtpConfigured() };
    }),
    // Admin: send test email
    sendTest: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ to: z.string().email() }))
      .mutation(async ({ input }) => {
        const { sendEmail } = await import("./email");
        return await sendEmail({
          to: input.to,
          subject: "اختبار البريد — المفتاح الشهري",
          html: `<div style="font-family:sans-serif;direction:rtl;text-align:center;padding:40px">
            <h2 style="color:#3ECFC0">تم الاتصال بنجاح!</h2>
            <p>هذا بريد اختباري من منصة المفتاح الشهري.</p>
            <p style="color:#999;font-size:12px">إذا وصلتك هذه الرسالة، فإعدادات SMTP صحيحة.</p>
          </div>`,
        });
      }),
  }),

  // Upload
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
  }),

  // ─── Reviews ────────────────────────────────────────────────────────
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

  // ─── Push Notifications ──────────────────────────────────────────
  push: router({
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }))
      .mutation(async ({ ctx, input }) => {
        return savePushSubscription(ctx.user.id, input);
      }),

    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return removePushSubscription(ctx.user.id, input.endpoint);
      }),

    status: protectedProcedure.query(async ({ ctx }) => {
      const count = await getUserSubscriptionCount(ctx.user.id);
      return { subscribed: count > 0, count, configured: isPushConfigured() };
    }),

    // Admin: send to specific user
    sendToUser: adminWithPermission(PERMISSIONS.SEND_NOTIFICATIONS)
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        body: z.string(),
        url: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return sendPushToUser(input.userId, { title: input.title, body: input.body, url: input.url });
      }),

    // Admin: broadcast to all
    broadcast: adminWithPermission(PERMISSIONS.SEND_NOTIFICATIONS)
      .input(z.object({
        title: z.string(),
        body: z.string(),
        url: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return sendPushBroadcast({ title: input.title, body: input.body, url: input.url });
      }),
  }),

  // ─── Roles Management ───────────────────────────────────────────
  roles: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_ROLES).query(async () => {
      const allRoles = await sharedDb.select().from(rolesTable);
      return allRoles.map(r => ({ ...r, permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions as string) : r.permissions }));
    }),

    getById: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const [role] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
        return { ...role, permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions as string) : role.permissions };
      }),

    create: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        name: z.string().max(100),
        nameAr: z.string().max(100),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
        permissions: z.array(z.string().max(100)),
      }))
      .mutation(async ({ input }) => {
        const result = await sharedDb.insert(rolesTable).values({
          ...input,
          permissions: JSON.stringify(input.permissions),
        } as any);
        return { id: result[0].insertId, success: true };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        id: z.number(),
        name: z.string().max(100).optional(),
        nameAr: z.string().max(100).optional(),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
        permissions: z.array(z.string().max(100)).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, permissions, ...rest } = input;
        const updateData: any = { ...rest };
        if (permissions) updateData.permissions = JSON.stringify(permissions);
        // Prevent editing system roles name
        const [existing] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, id));
        if (existing?.isSystem) {
          delete updateData.name;
          delete updateData.nameAr;
        }
        await sharedDb.update(rolesTable).set(updateData).where(eqDrizzle(rolesTable.id, id));
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const [existing] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        if (existing?.isSystem) throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete system role' });
        await sharedDb.delete(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        return { success: true };
      }),

    // Assign role to user
    assignToUser: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        userId: z.number(),
        roleId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const [role] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.roleId));
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
        const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions as string) : role.permissions;
        await db.setAdminPermissions(input.userId, perms);
        clearPermissionCache(input.userId);
        return { success: true };
      }),
  }),

  // Permission categories for frontend
  permissionMeta: router({
    categories: publicProcedure.query(() => {
      return PERMISSION_CATEGORIES;
    }),
  }),

  // AI Rating Stats for admin
  aiStats: router({
    ratingOverview: adminWithPermission(PERMISSIONS.MANAGE_AI).query(async () => {
      const allRated = await sharedDb.select().from(aiMessagesTable).where(
        eqDrizzle(aiMessagesTable.role, 'assistant')
      );
      const rated = allRated.filter(m => m.rating !== null && m.rating !== undefined);
      const total = rated.length;
      if (total === 0) return { totalRated: 0, averageRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      const sum = rated.reduce((acc, m) => acc + (m.rating || 0), 0);
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      rated.forEach(m => { if (m.rating) dist[m.rating] = (dist[m.rating] || 0) + 1; });
      return { totalRated: total, averageRating: Math.round((sum / total) * 10) / 10, distribution: dist };
    }),

    recentRated: adminWithPermission(PERMISSIONS.MANAGE_AI)
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 20;
        const messages = await sharedDb.select().from(aiMessagesTable)
          .where(eqDrizzle(aiMessagesTable.role, 'assistant'))
          .orderBy(aiMessagesTable.createdAt)
          .limit(200);
        return messages.filter(m => m.rating !== null).slice(-limit).reverse();
      }),
  }),
});
export type AppRouter = typeof appRouter;
