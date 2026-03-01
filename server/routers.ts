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
import { withTransaction } from "./db";
import { cache, cacheThrough, CACHE_TTL, CACHE_KEYS } from "./cache";
import { rateLimiter, RATE_LIMITS, getClientIP } from "./rate-limiter";
import { getAiResponse, seedDefaultKnowledgeBase } from "./ai-assistant";
import { getKBSections, getAdminKBForCopilot } from "./ai/adminKnowledge";
import { optimizeImage, optimizeAvatar } from "./image-optimizer";
import { generateLeaseContractHTML } from "./lease-contract";
import { createPayPalOrder, capturePayPalOrder, getPayPalSettings } from "./paypal";
import { notifyOwner } from "./_core/notification";
import { calculateBookingTotal, parseCalcSettings } from "./booking-calculator";
import { sendBookingConfirmation, sendPaymentReceipt, sendMaintenanceUpdate, sendNewMaintenanceAlert, verifySmtpConnection, isSmtpConfigured } from "./email";
import { savePushSubscription, removePushSubscription, sendPushToUser, sendPushBroadcast, isPushConfigured, getUserSubscriptionCount } from "./push";
import { roles as rolesTable, aiMessages as aiMessagesTable, whatsappMessages, units, auditLog, integrationConfigs } from "../drizzle/schema";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq as eqDrizzle, and as andDrizzle, ne as neDrizzle } from "drizzle-orm";
import { sanitizeText, sanitizeObject, validateContentType, validateFileExtension, MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_UPLOAD_TYPES, capLimit, capOffset, isOwnerOrAdmin, isBookingParticipant } from "./security";
import { financeRouter } from "./finance-routers";
import { submissionRouter } from "./submission-routers";
import { integrationRouter } from "./integration-routers";
import { sendTemplateMessage, sendTextMessage, getWhatsAppConfig, formatPhoneForWhatsApp, maskPhone } from "./whatsapp-cloud";
import { logAudit } from "./audit-log";
import { dbIdentity } from "./_core/env";

// Shared drizzle instance for roles/aiStats (avoid creating new connections per request)
// Uses centralized ENV.databaseUrl to ensure correct DB per environment
const sharedPool = mysql.createPool(ENV.databaseUrl);
const sharedDb = drizzle(sharedPool);

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
        recoveryEmail: z.string().email().optional(),
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
        // When pricingSource=UNIT, override monthlyRent with the linked unit's rent
        let effectiveRent = prop.monthlyRent;
        if (prop.pricingSource === "UNIT") {
          try {
            const financeReg = await import("./finance-registry");
            const linkedUnit = await financeReg.getLinkedUnitByPropertyId(input.id);
            if (linkedUnit?.monthlyBaseRentSAR) {
              effectiveRent = linkedUnit.monthlyBaseRentSAR;
            }
          } catch (e) {
            console.error("[getById] Failed to get unit price:", e);
          }
        }
        return { ...prop, monthlyRent: effectiveRent, manager: manager ?? null };
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

        // ─── Validation: duration from system settings ───
        const allSettings = await db.getAllSettings();
        const minMonths = parseInt(allSettings["rental.minMonths"] || "1");
        const maxMonths = parseInt(allSettings["rental.maxMonths"] || "2");
        if (input.durationMonths < minMonths || input.durationMonths > maxMonths) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Duration must be between ${minMonths} and ${maxMonths} months / المدة يجب أن تكون بين ${minMonths} و ${maxMonths} شهر` });
        }

        // ─── Resolve effective monthly rent ───
        let effectiveRent = prop.monthlyRent;
        if ((prop as any).pricingSource === 'UNIT') {
          try {
            const { getLinkedUnitByPropertyId } = await import('./finance-registry.js');
            const linkedUnit = await getLinkedUnitByPropertyId(input.propertyId);
            if (linkedUnit?.monthlyBaseRentSAR) {
              effectiveRent = String(linkedUnit.monthlyBaseRentSAR);
            }
          } catch (e) { /* fallback to property rent */ }
        }
        const monthlyRentNum = Number(effectiveRent);
        if (!monthlyRentNum || monthlyRentNum <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Property has no valid monthly rent / العقار ليس له إيجار شهري صالح' });
        }

        // ─── Calculate full breakdown using shared calculator (same as cost calculator) ───
        const calcSettings = parseCalcSettings(allSettings);
        const calc = calculateBookingTotal(
          { monthlyRent: monthlyRentNum, durationMonths: input.durationMonths },
          calcSettings
        );

        // ─── Create booking with full total (includes fees + VAT) ───
        const id = await db.createBooking({
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          landlordId: prop.landlordId,
          status: prop.instantBook ? "approved" : "pending",
          moveInDate: new Date(input.moveInDate),
          moveOutDate: new Date(input.moveOutDate),
          durationMonths: input.durationMonths,
          monthlyRent: effectiveRent,
          securityDeposit: String(calc.insuranceAmount),
          totalAmount: String(calc.grandTotal),
          fees: String(calc.serviceFeeAmount),
          vatAmount: String(calc.vatAmount),
          tenantNotes: input.tenantNotes,
          priceBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            serviceFeeAmount: calc.serviceFeeAmount,
            subtotal: calc.subtotal,
            vatAmount: calc.vatAmount,
            grandTotal: calc.grandTotal,
            appliedRates: calc.appliedRates,
            currency: calc.currency,
          },
        });

        // ─── Auto-create payment_ledger entry for this booking ───
        try {
          const { createLedgerEntry, getLinkedUnitByPropertyId: getUnit } = await import('./finance-registry.js');
          let unitId: number | undefined;
          let unitNumber: string | undefined;
          let buildingId: number | undefined;
          try {
            const linkedUnit = await getUnit(input.propertyId);
            if (linkedUnit) {
              unitId = linkedUnit.id;
              unitNumber = linkedUnit.unitNumber;
              buildingId = linkedUnit.buildingId;
            }
          } catch { /* no linked unit */ }
          await createLedgerEntry({
            bookingId: id!,
            unitId,
            unitNumber,
            buildingId,
            propertyDisplayName: prop.titleAr || prop.titleEn || `Property #${prop.id}`,
            type: 'RENT',
            direction: 'IN',
            amount: String(calc.grandTotal),
            currency: calc.currency,
            status: 'DUE',
            dueAt: new Date(input.moveInDate),
            createdBy: ctx.user.id,
            guestName: ctx.user.displayName || ctx.user.name || undefined,
            guestEmail: ctx.user.email || undefined,
            notes: `Booking #${id}: Rent ${calc.baseRentTotal} + Insurance ${calc.insuranceAmount} + Service ${calc.serviceFeeAmount} + VAT ${calc.vatAmount} = Total ${calc.grandTotal} SAR`,
            notesAr: `حجز #${id}: إيجار ${calc.baseRentTotal} + تأمين ${calc.insuranceAmount} + رسوم خدمة ${calc.serviceFeeAmount} + ضريبة ${calc.vatAmount} = إجمالي ${calc.grandTotal} ر.س`,
          });
        } catch (e) {
          process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to auto-create ledger entry', bookingId: id, error: (e as Error).message }) + '\n');
        }

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
            content: `طلب حجز جديد للعقار: ${prop.titleAr || prop.titleEn}\nالمستأجر: ${ctx.user.displayName || ctx.user.name}\nالمدة: ${input.durationMonths} شهر\nالإجمالي: ${calc.grandTotal} ر.س (إيجار ${calc.baseRentTotal} + تأمين ${calc.insuranceAmount} + رسوم ${calc.serviceFeeAmount} + ضريبة ${calc.vatAmount})\n\nNew booking for: ${prop.titleEn}\nTenant: ${ctx.user.displayName || ctx.user.name}\nDuration: ${input.durationMonths} month(s)\nTotal: SAR ${calc.grandTotal} (Rent ${calc.baseRentTotal} + Insurance ${calc.insuranceAmount} + Fee ${calc.serviceFeeAmount} + VAT ${calc.vatAmount})`,
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
                totalAmount: calc.grandTotal,
                bookingId: id!,
              });
            }
          } catch { /* email is best-effort */ }
        }
        // Structured log for booking creation (observability)
        const logEntry = {
          ts: new Date().toISOString(),
          level: 'info',
          component: 'booking',
          msg: 'Booking created',
          bookingId: id,
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          durationMonths: input.durationMonths,
          monthlyRent: monthlyRentNum,
          grandTotal: calc.grandTotal,
          status: prop.instantBook ? 'approved' : 'pending',
        };
        process.stdout.write(JSON.stringify(logEntry) + '\n');

        return {
          id,
          status: prop.instantBook ? "approved" : "pending",
          priceBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            serviceFeeAmount: calc.serviceFeeAmount,
            subtotal: calc.subtotal,
            vatAmount: calc.vatAmount,
            grandTotal: calc.grandTotal,
            appliedRates: calc.appliedRates,
            currency: calc.currency,
          },
        };
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
        // Attach ledger entries for this booking
        let ledgerEntries: any[] = [];
        let paymentConfigured = false;
        try {
          const { getLedgerByBookingId, isPaymentConfigured } = await import('./finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(input.id);
          const payConfig = await isPaymentConfigured();
          paymentConfigured = payConfig.configured;
        } catch { /* no ledger data */ }
        return { ...booking, ledgerEntries, paymentConfigured };
      }),

    myBookings: protectedProcedure.query(async ({ ctx }) => {
      const myBookings = await db.getBookingsByTenant(ctx.user.id);
      // Enrich with ledger entries and payment config
      let paymentConfigured = false;
      try {
        const { isPaymentConfigured } = await import('./finance-registry.js');
        const pc = await isPaymentConfigured();
        paymentConfigured = pc.configured;
      } catch { /* ignore */ }
      const enriched = await Promise.all(myBookings.map(async (b: any) => {
        let ledgerEntries: any[] = [];
        try {
          const { getLedgerByBookingId } = await import('./finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(b.id);
        } catch { /* ignore */ }
        return { ...b, ledgerEntries, paymentConfigured };
      }));
      return enriched;
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
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const notifications = await db.getNotificationsByUser(ctx.user.id);
        const owns = notifications.some((n: any) => n.id === input.id);
        if (!owns) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.deleteNotification(input.id);
        return { success: true };
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
        const errors: string[] = [];
        if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
          if (!prop.monthlyRent || Number(prop.monthlyRent) <= 0) errors.push('monthlyRent must be > 0 for PROPERTY pricing');
        } else if ((prop as any).pricingSource === 'UNIT') {
          const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
          const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
          if (validUnits.length !== 1) errors.push('UNIT pricing requires exactly one linked unit (not BLOCKED/MAINTENANCE)');
          else if (!validUnits[0].monthlyBaseRentSAR || Number(validUnits[0].monthlyBaseRentSAR) <= 0) errors.push('Linked unit must have monthlyBaseRentSAR > 0');
        }
        if (!prop.titleEn && !prop.titleAr) errors.push('Property must have at least one title / يجب أن يكون للعقار عنوان');
        const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
        if (!hasPhotos) errors.push('Property must have at least one photo / يجب أن يكون للعقار صورة واحدة على الأقل');
        if (errors.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `Publish guard failed: ${errors.join('; ')}` });
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
        const checks: { label: string; labelAr: string; passed: boolean; detail?: string }[] = [];
        checks.push({ label: 'Has title', labelAr: 'يوجد عنوان', passed: !!(prop.titleEn || prop.titleAr) });
        if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
          checks.push({ label: 'Monthly rent > 0', labelAr: 'الإيجار الشهري > 0', passed: Number(prop.monthlyRent) > 0, detail: `SAR ${prop.monthlyRent}` });
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
          checks.push({ label: 'Linked unit with valid rent', labelAr: 'وحدة مرتبطة بإيجار صالح', ...unitCheck });
        }
        const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
        checks.push({ label: 'Has photos', labelAr: 'يوجد صور', passed: !!hasPhotos, detail: hasPhotos ? `${(prop.photos as string[]).length} photos` : 'No photos' });
        checks.push({ label: 'Has location', labelAr: 'يوجد موقع', passed: !!(prop.city || prop.cityAr) });
        const hasCoords = !!(prop.latitude && prop.longitude && Number(prop.latitude) !== 0);
        checks.push({ label: 'Has coordinates', labelAr: 'يوجد إحداثيات', passed: hasCoords, detail: hasCoords ? `${prop.latitude}, ${prop.longitude}` : 'استخدم الترميز الجغرافي أو الدبوس' });
        const allPassed = checks.every(c => c.passed);
        return { ready: allPassed, checks, pricingSource: (prop as any).pricingSource || 'PROPERTY', status: prop.status };
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

        // Clean empty strings → null for decimal/numeric columns to avoid MySQL errors
        const numericFields = ['monthlyRent', 'securityDeposit', 'latitude', 'longitude', 'sizeSqm'];
        const cleaned: any = { ...data };
        for (const key of Object.keys(cleaned)) {
          if (cleaned[key] === '' && numericFields.includes(key)) {
            cleaned[key] = null;
          }
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
          const { isPaymentConfigured } = await import('./finance-registry.js');
          const pc = await isPaymentConfigured();
          paymentConfigured = pc.configured;
        } catch { /* ignore */ }
        const enriched = await Promise.all(bookingsList.map(async (b: any) => {
          let ledgerEntries: any[] = [];
          try {
            const { getLedgerByBookingId } = await import('./finance-registry.js');
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
          const { voidLedgerByBookingId } = await import('./finance-registry.js');
          const voided = await voidLedgerByBookingId(input.id, input.rejectionReason);
          console.log(`[Ledger] Voided ${voided} entries for rejected booking #${input.id}`);
        } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to void entries on rejection', error: (e as Error).message }) + '\n'); }
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
        const { getStorageInfo } = await import('./storage');
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
          const { getLedgerByBookingId, updateLedgerStatusSafe } = await import('./finance-registry.js');
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
          const { logAudit } = await import('./audit-log.js');
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

        let response: string;
        try {
          // Get AI response
          response = await getAiResponse(
            ctx.user.id,
            input.conversationId,
            input.message,
            ctx.user.role,
          );
        } catch (error: any) {
          console.error("[AI Chat Error]", error?.message || error);
          // Provide a friendly fallback response instead of crashing
          const errorMsg = error?.message || "";
          if (errorMsg.includes("API key") || errorMsg.includes("401") || errorMsg.includes("Incorrect")) {
            response = "عذراً، المساعد الذكي غير متاح حالياً بسبب مشكلة في الإعدادات. يرجى التواصل مع الدعم الفني. \n\nSorry, the AI assistant is currently unavailable due to a configuration issue. Please contact support.";
          } else if (errorMsg.includes("429") || errorMsg.includes("rate limit")) {
            response = "عذراً، تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل. \n\nSorry, rate limit exceeded. Please try again in a moment.";
          } else if (errorMsg.includes("timeout") || errorMsg.includes("ECONNREFUSED")) {
            response = "عذراً، لم أتمكن من الاتصال بالخادم. يرجى المحاولة مرة أخرى. \n\nSorry, I couldn't connect to the server. Please try again.";
          } else {
            response = "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى. \n\nSorry, an error occurred while processing your request. Please try again.";
          }
        }

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

    // Admin: Test API key
    testApiKey: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ apiKey: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${input.apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: "Say OK" }],
              max_tokens: 5,
            }),
          });
          if (response.ok) {
            return { success: true };
          }
          const errorData = await response.json().catch(() => ({}));
          const errMsg = (errorData as any)?.error?.message || `HTTP ${response.status}`;
          if (errMsg.includes("quota") || errMsg.includes("billing")) {
            return { success: false, error: "\u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0635\u0627\u0644\u062d \u0644\u0643\u0646 \u0644\u0627 \u064a\u0648\u062c\u062f \u0631\u0635\u064a\u062f \u0643\u0627\u0641\u064a. \u0623\u0636\u0641 \u0631\u0635\u064a\u062f \u0641\u064a platform.openai.com" };
          }
          return { success: false, error: errMsg };
        } catch (err: any) {
          return { success: false, error: err?.message || "Connection failed" };
        }
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
    // Admin KB sections from docs/kb/ markdown files
    kbSections: protectedProcedure
      .input(z.object({ lang: z.string().optional() }))
      .query(({ input }) => {
        return getKBSections(input.lang || "ar");
      }),
  }),
  // Lease Contractt
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

  // ─── Cost Calculator (fully backend-driven) ──────────────────────────
  calculator: router({
    /** GET config: returns all calculator parameters for frontend/mobile */
    getConfig: publicProcedure.query(async () => {
      const settings = await cacheThrough(
        CACHE_KEYS.settings(),
        CACHE_TTL.SETTINGS,
        () => db.getAllSettings()
      );
      const allowedMonthsRaw = settings["calculator.allowedMonths"] || settings["rental.allowedMonths"] || "[1,2]";
      let allowedMonths: number[];
      try {
        allowedMonths = JSON.parse(allowedMonthsRaw);
        if (!Array.isArray(allowedMonths) || allowedMonths.length === 0) allowedMonths = [1, 2];
      } catch {
        allowedMonths = [1, 2];
      }
      // Insurance mode: "percentage" or "fixed"
      const insuranceMode = settings["calculator.insuranceMode"] || "percentage";
      const hideInsurance = settings["calculator.hideInsuranceFromTenant"] === "true";

      return {
        allowedMonths: allowedMonths.sort((a, b) => a - b),
        insuranceRate: parseFloat(settings["fees.depositPercent"] || "10"),
        insuranceFixedAmount: parseFloat(settings["calculator.insuranceFixedAmount"] || "0"),
        insuranceMode,
        hideInsuranceFromTenant: hideInsurance,
        serviceFeeRate: parseFloat(settings["fees.serviceFeePercent"] || "5"),
        vatRate: parseFloat(settings["fees.vatPercent"] || "15"),
        currency: settings["payment.currency"] || "SAR",
        currencySymbolAr: "ر.س",
        currencySymbolEn: "SAR",
        version: settings["calculator.version"] || "1",
        labels: {
          insuranceAr: settings["calculator.insuranceLabelAr"] || "التأمين",
          insuranceEn: settings["calculator.insuranceLabelEn"] || "Insurance/Deposit",
          serviceFeeAr: settings["calculator.serviceFeeLabelAr"] || "رسوم الخدمة",
          serviceFeeEn: settings["calculator.serviceFeeLabelEn"] || "Service Fee",
          vatAr: settings["calculator.vatLabelAr"] || "ضريبة القيمة المضافة",
          vatEn: settings["calculator.vatLabelEn"] || "VAT",
          insuranceTooltipAr: settings["calculator.insuranceTooltipAr"] || "مبلغ تأمين قابل للاسترداد عند انتهاء العقد",
          insuranceTooltipEn: settings["calculator.insuranceTooltipEn"] || "Refundable security deposit returned at end of lease",
          serviceFeeTooltipAr: settings["calculator.serviceFeeTooltipAr"] || "رسوم إدارة المنصة لتسهيل عملية التأجير",
          serviceFeeTooltipEn: settings["calculator.serviceFeeTooltipEn"] || "Platform management fee for facilitating the rental",
          vatTooltipAr: settings["calculator.vatTooltipAr"] || "ضريبة القيمة المضافة وفقاً لنظام هيئة الزكاة والضريبة والجمارك",
          vatTooltipEn: settings["calculator.vatTooltipEn"] || "Value Added Tax as per ZATCA regulations",
        },
      };
    }),

    /** POST calculate: server-side calculation with full validation
     *  Uses the SAME shared calculateBookingTotal function as booking.create
     *  to guarantee calculator preview matches actual charge. */
    calculate: publicProcedure
      .input(z.object({
        monthlyRent: z.number().positive("Monthly rent must be positive"),
        selectedMonths: z.number().int().positive("Duration must be a positive integer"),
      }))
      .mutation(async ({ input }) => {
        const settings = await cacheThrough(
          CACHE_KEYS.settings(),
          CACHE_TTL.SETTINGS,
          () => db.getAllSettings()
        );

        // Parse allowed months
        const allowedMonthsRaw = settings["calculator.allowedMonths"] || settings["rental.allowedMonths"] || "[1,2]";
        let allowedMonths: number[];
        try {
          allowedMonths = JSON.parse(allowedMonthsRaw);
          if (!Array.isArray(allowedMonths) || allowedMonths.length === 0) allowedMonths = [1, 2];
        } catch {
          allowedMonths = [1, 2];
        }

        // Validate duration
        if (!allowedMonths.includes(input.selectedMonths)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Duration ${input.selectedMonths} months is not allowed. Allowed: ${allowedMonths.join(", ")} months`,
          });
        }

        // Validate rent range
        const minRent = parseFloat(settings["fees.minRent"] || "500");
        const maxRent = parseFloat(settings["fees.maxRent"] || "100000");
        if (input.monthlyRent < minRent || input.monthlyRent > maxRent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Monthly rent must be between ${minRent} and ${maxRent}`,
          });
        }

        // Use the SHARED calculator (same as booking.create)
        const { calculateBookingTotal, parseCalcSettings } = await import("./booking-calculator");
        const calcSettings = parseCalcSettings(settings);
        const calc = calculateBookingTotal(
          { monthlyRent: input.monthlyRent, durationMonths: input.selectedMonths },
          calcSettings
        );

        return {
          // Input echo
          monthlyRent: input.monthlyRent,
          selectedMonths: input.selectedMonths,
          // Breakdown for tenant (insurance may be hidden)
          rentTotal: calc.displayRentTotal,
          insuranceAmount: calc.displayInsurance,
          serviceFeeAmount: calc.serviceFeeAmount,
          subtotal: calc.hideInsuranceFromTenant
            ? (calc.displayRentTotal + calc.serviceFeeAmount)
            : calc.subtotal,
          vatAmount: calc.vatAmount,
          grandTotal: calc.grandTotal,
          // Flag so frontend knows whether to show insurance line
          insuranceHidden: calc.hideInsuranceFromTenant,
          // Applied rates (for transparency)
          appliedRates: calc.appliedRates,
          currency: calc.currency,
          // Admin-only breakdown (full details for backend/admin use)
          _adminBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            insuranceMode: calc.appliedRates.insuranceMode,
            insuranceHidden: calc.hideInsuranceFromTenant,
          },
        };
      }),
  }),

  // ─── WhatsApp Messages (Cloud API + Click-to-Chat) ─────────────────
  whatsapp: router({
    // Send a message (click-to-chat logs only, or Cloud API actual send)
    send: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        recipientPhone: z.string().min(10),
        recipientName: z.string().optional(),
        userId: z.number().optional(),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]),
        templateName: z.string().optional(),
        messageBody: z.string().min(1),
        propertyId: z.number().optional(),
        bookingId: z.number().optional(),
        channel: z.enum(["click_to_chat", "cloud_api"]).default("click_to_chat"),
      }))
      .mutation(async ({ input, ctx }) => {
        let status: string = "sent";
        let providerMsgId: string | null = null;
        let errorMessage: string | null = null;

        if (input.channel === "cloud_api") {
          // Actually send via WhatsApp Cloud API
          const result = await sendTextMessage(input.recipientPhone, input.messageBody);
          if (result.success) {
            status = "sent";
            providerMsgId = result.providerMsgId || null;
          } else {
            status = "failed";
            errorMessage = result.error || "Unknown error";
          }
        }

        const msgId = await db.createWhatsAppMessage({
          ...input,
          recipientName: input.recipientName || null,
          userId: input.userId || null,
          templateName: input.templateName || null,
          propertyId: input.propertyId || null,
          bookingId: input.bookingId || null,
          sentBy: ctx.user.id,
          status: status as any,
          sentAt: new Date(),
        });

        // Update providerMsgId if we got one
        if (providerMsgId) {
          const pool = db.getPool();
          if (pool) {
            await pool.query(`UPDATE whatsapp_messages SET providerMsgId = ? WHERE id = ?`, [providerMsgId, msgId]);
          }
        }
        if (errorMessage) {
          const pool = db.getPool();
          if (pool) {
            await pool.query(`UPDATE whatsapp_messages SET errorMessage = ? WHERE id = ?`, [errorMessage, msgId]);
          }
        }

        // Audit log (mask phone)
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "SEND",
            entityType: "WHATSAPP_MESSAGE",
            entityId: msgId,
            entityLabel: `WhatsApp to ${maskPhone(input.recipientPhone)}`,
            metadata: { channel: input.channel, messageType: input.messageType, status },
          });
        } catch {}

        return { id: msgId, status, providerMsgId, error: errorMessage };
      }),

    // Send template message via Cloud API
    sendTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        recipientPhone: z.string().min(10),
        recipientName: z.string().optional(),
        userId: z.number().optional(),
        templateId: z.number(),
        variables: z.record(z.string(), z.string()).optional(),
        propertyId: z.number().optional(),
        bookingId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.getWhatsAppTemplate(input.templateId);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

        // Build message body from template with variable substitution
        let body = template.bodyAr || template.bodyEn || "";
        const vars = input.variables || {};
        for (const [key, val] of Object.entries(vars)) {
          body = body.replace(new RegExp(`\\{${key}\\}`, "g"), val);
        }

        let status = "sent";
        let providerMsgId: string | null = null;
        let errorMessage: string | null = null;

        // If template has a Meta template name, send via Cloud API
        if (template.metaTemplateName && (template.channel === "cloud_api" || template.channel === "both")) {
          const variableValues = template.variableKeys
            ? JSON.parse(template.variableKeys).map((k: string) => vars[k] || "")
            : [];
          const result = await sendTemplateMessage({
            to: input.recipientPhone,
            templateName: template.metaTemplateName,
            languageCode: template.languageCode || "ar",
            variables: variableValues,
          });
          if (result.success) {
            providerMsgId = result.providerMsgId || null;
          } else {
            status = "failed";
            errorMessage = result.error || "Template send failed";
          }
        }

        // Log the message
        const msgId = await db.createWhatsAppMessage({
          recipientPhone: input.recipientPhone,
          recipientName: input.recipientName || null,
          userId: input.userId || null,
          messageType: template.messageType,
          templateName: template.templateKey,
          messageBody: body,
          propertyId: input.propertyId || null,
          bookingId: input.bookingId || null,
          channel: template.metaTemplateName ? "cloud_api" : "click_to_chat",
          sentBy: ctx.user.id,
          status: status as any,
          sentAt: new Date(),
        });

        if (providerMsgId) {
          const pool = db.getPool();
          if (pool) await pool.query(`UPDATE whatsapp_messages SET providerMsgId = ? WHERE id = ?`, [providerMsgId, msgId]);
        }

        return { id: msgId, status, providerMsgId, error: errorMessage };
      }),

    // List messages with filters
    list: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        messageType: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.listWhatsAppMessages(input);
      }),

    // Get stats
    stats: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      return db.getWhatsAppStats();
    }),

    // Get message templates (from DB)
    templates: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      await db.seedDefaultWhatsAppTemplates();
      return db.listWhatsAppTemplates();
    }),

    // Create template
    createTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        templateKey: z.string().min(1).max(100),
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        metaTemplateName: z.string().optional(),
        languageCode: z.string().default("ar"),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]),
        bodyEn: z.string().optional(),
        bodyAr: z.string().optional(),
        variableKeys: z.array(z.string()).optional(),
        channel: z.enum(["click_to_chat", "cloud_api", "both"]).default("both"),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createWhatsAppTemplateRecord(input);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "CREATE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: id || 0,
            entityLabel: input.nameEn,
          });
        } catch {}
        return { id };
      }),

    // Update template
    updateTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        metaTemplateName: z.string().optional(),
        languageCode: z.string().optional(),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]).optional(),
        bodyEn: z.string().optional(),
        bodyAr: z.string().optional(),
        variableKeys: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        channel: z.enum(["click_to_chat", "cloud_api", "both"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWhatsAppTemplateRecord(input.id, input);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "UPDATE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: input.id,
            entityLabel: `Template #${input.id}`,
          });
        } catch {}
        return { success: true };
      }),

    // Delete template
    deleteTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteWhatsAppTemplateRecord(input.id);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "DELETE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: input.id,
            entityLabel: `Template #${input.id}`,
          });
        } catch {}
        return { success: true };
      }),

    // Check if WhatsApp Cloud API is configured
    isConfigured: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      const config = await getWhatsAppConfig();
      return {
        configured: !!config,
        cloudApiEnabled: !!config?.accessToken,
        senderName: config?.senderName || null,
      };
    }),
  }),
  // ─── Property Submissions (Lead Intake + Admin Review) ──
  submission: submissionRouter,
  // ─── Finance Registry (Buildings, Units, Ledger, KPIs, Renewals) ──
  finance: financeRouter,
  // ─── Integration Configs (Admin Settings Panel) ──
  integration: integrationRouter,

  // ─── Maps (Geocoding, Pin Picker, Privacy Controls) ──
  maps: router({
    // Public: get maps config (no secrets)
    getConfig: publicProcedure.query(async () => {
      const { getMapsConfigPublic } = await import("./maps-service");
      return getMapsConfigPublic();
    }),

    // Admin: geocode an address
    geocode: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        city: z.string().optional(),
        district: z.string().optional(),
        address: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { geocodeAddress } = await import("./maps-service");
        return geocodeAddress(input, ctx.user.id);
      }),

    // Admin: update property location (from geocode, pin, or manual)
    setPropertyLocation: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        propertyId: z.number(),
        latitude: z.string(),
        longitude: z.string(),
        locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]),
        locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
        placeId: z.string().optional(),
        geocodeProvider: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updatePropertyLocation } = await import("./maps-service");
        const result = await updatePropertyLocation(input.propertyId, input, ctx.user.id);
        cache.invalidatePrefix('property:');
        return result;
      }),

    // Admin: get geocode cache stats
    cacheStats: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        const { getGeocodeStats } = await import("./maps-service");
        return getGeocodeStats();
      }),

    // Public: get property location with privacy applied
    getPropertyLocation: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const { getMapsConfigPublic, approximateCoordinates } = await import("./maps-service");
        const config = await getMapsConfigPublic();
        if (!config.enabled || !config.showOnPropertyPage) {
          return { showMap: false, reason: "maps_disabled" as const };
        }
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || !prop.latitude || !prop.longitude) {
          return { showMap: false, reason: "no_coordinates" as const };
        }
        const visibility = (prop as any).locationVisibility || "APPROXIMATE";
        if (visibility === "HIDDEN") {
          return { showMap: false, reason: "hidden" as const, city: prop.city, district: prop.district };
        }
        const lat = parseFloat(String(prop.latitude));
        const lng = parseFloat(String(prop.longitude));
        if (visibility === "APPROXIMATE") {
          const approx = approximateCoordinates(lat, lng);
          return {
            showMap: true,
            lat: approx.lat,
            lng: approx.lng,
            visibility: "APPROXIMATE" as const,
            zoom: config.defaultZoom,
            provider: config.provider,
          };
        }
        // EXACT
        return {
          showMap: true,
          lat,
          lng,
          visibility: "EXACT" as const,
          zoom: config.defaultZoom + 2,
          provider: config.provider,
        };
      }),
  }),
  // ─── Audit Log (Admin Viewer) ──
  audit: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        entityType: z.string().optional(),
        action: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const pool = (await import('./db')).getPool();
        if (!pool) return { items: [], total: 0 };
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.entityType) { conditions.push('entityType = ?'); params.push(input.entityType); }
        if (input.action) { conditions.push('action = ?'); params.push(input.action); }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (input.page - 1) * input.limit;
        const [rows] = await pool.execute(
          `SELECT * FROM audit_log ${where} ORDER BY createdAt DESC LIMIT ${input.limit} OFFSET ${offset}`,
          params
        );
        const [countRows] = await pool.execute(
          `SELECT COUNT(*) as total FROM audit_log ${where}`,
          params
        );
        return { items: rows as any[], total: (countRows as any[])[0]?.total ?? 0 };
      }),
  }),
});
export type AppRouter = typeof appRouter;
