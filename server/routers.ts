import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";
import { getAiResponse, seedDefaultKnowledgeBase } from "./ai-assistant";
import { generateLeaseContractHTML } from "./lease-contract";

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
        bio: z.string().optional(),
        bioAr: z.string().optional(),
        preferredLang: z.enum(["ar", "en"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input as any);
        return { success: true };
      }),
    switchRole: protectedProcedure
      .input(z.object({ role: z.enum(["tenant", "landlord"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

  // ─── Properties ──────────────────────────────────────────────────
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
        if (!prop) throw new Error("Property not found");
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("Unauthorized");
        await db.updateProperty(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new Error("Property not found");
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("Unauthorized");
        await db.deleteProperty(input.id);
        return { success: true };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prop = await db.getPropertyById(input.id);
        if (prop) await db.incrementPropertyViews(input.id);
        return prop ?? null;
      }),

    getByLandlord: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getPropertiesByLandlord(ctx.user.id);
      }),

    search: publicProcedure
      .input(z.object({
        city: z.string().optional(),
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        furnishedLevel: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.searchProperties(input);
      }),

    featured: publicProcedure
      .query(async () => {
        const result = await db.searchProperties({ limit: 6 });
        return result.items;
      }),

    uploadPhoto: protectedProcedure
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `properties/${ctx.user.id}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
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
      .mutation(async ({ input }) => {
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

  // ─── Favorites ───────────────────────────────────────────────────
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

  // ─── Bookings ────────────────────────────────────────────────────
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
        if (!prop) throw new Error("Property not found");
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
        if (!booking) throw new Error("Booking not found");
        if (booking.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("Unauthorized");
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
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBookingById(input.id) ?? null;
      }),

    myBookings: protectedProcedure.query(async ({ ctx }) => {
      return db.getBookingsByTenant(ctx.user.id);
    }),

    landlordBookings: protectedProcedure.query(async ({ ctx }) => {
      return db.getBookingsByLandlord(ctx.user.id);
    }),
  }),

  // ─── Payments ────────────────────────────────────────────────────
  payment: router({
    create: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        type: z.enum(["rent", "deposit", "service_fee"]),
        amount: z.string(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new Error("Booking not found");
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
  }),

  // ─── Messages ────────────────────────────────────────────────────
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
        content: z.string().min(1),
        messageType: z.enum(["text", "image", "file"]).optional(),
        fileUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let convId = input.conversationId;
        if (!convId && input.recipientId) {
          const conv = await db.getOrCreateConversation(ctx.user.id, input.recipientId, input.propertyId);
          convId = conv?.id;
        }
        if (!convId) throw new Error("Conversation not found");
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

  // ─── Maintenance ─────────────────────────────────────────────────
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
        if (!prop) throw new Error("Property not found");
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
        if (!req) throw new Error("Request not found");
        if (req.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new Error("Unauthorized");
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
      .query(async ({ input }) => {
        return db.getMaintenanceById(input.id) ?? null;
      }),
  }),

  // ─── Notifications ───────────────────────────────────────────────
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotificationsByUser(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationRead(input.id);
        return { success: true };
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),
  }),

  // ─── Reviews ─────────────────────────────────────────────────────
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

  // ─── Saved Searches ──────────────────────────────────────────────
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
      .mutation(async ({ input }) => {
        await db.deleteSavedSearch(input.id);
        return { success: true };
      }),
  }),

  // ─── Admin ───────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(async () => {
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

    users: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllUsers(input.limit, input.offset);
      }),

    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "landlord", "tenant"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    properties: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getAllProperties(input.limit, input.offset, input.status);
      }),

    approveProperty: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["active", "rejected"]), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.updateProperty(input.id, { status: input.status });
        return { success: true };
      }),

    bookings: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllBookings(input.limit, input.offset);
      }),
  }),

  // ─── AI Assistant ────────────────────────────────────────────────
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
  }),

  // ─── Knowledge Base ─────────────────────────────────────────────
  knowledge: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getKnowledgeArticles(input?.category);
      }),

    all: adminProcedure.query(async () => {
      return db.getAllKnowledgeArticles();
    }),

    create: adminProcedure
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

    update: adminProcedure
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

    delete: adminProcedure
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

  // ─── Lease Contract ───────────────────────────────────────────────
  lease: router({
    generate: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ input }) => {
        const { html, data } = await generateLeaseContractHTML(input.bookingId);
        return { html, contractNumber: data.contractNumber };
      }),
  }),

  // ─── Upload ──────────────────────────────────────────────────────
  upload: router({
    file: protectedProcedure
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split('.').pop() || 'bin';
        const key = `uploads/${ctx.user.id}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
