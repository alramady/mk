/**
 * Property Submissions Router
 * Handles public lead intake + admin review + conversion to property
 */
import { TRPCError } from "@trpc/server";
import { publicProcedure, adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import { z } from "zod";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";
import { optimizeImage } from "./image-optimizer";
import { cache } from "./cache";
import { rateLimiter, getClientIP } from "./rate-limiter";
import { validateContentType, MAX_BASE64_SIZE, ALLOWED_IMAGE_TYPES } from "./security";

export const submissionRouter = router({
  // ─── Public: Create Submission (Lead Intake) ──────────────────────
  create: publicProcedure
    .input(z.object({
      ownerName: z.string().min(2).max(255),
      ownerNameAr: z.string().max(255).optional(),
      phone: z.string().min(5).max(30),
      email: z.string().email().max(255).optional(),
      city: z.string().max(100).optional(),
      cityAr: z.string().max(100).optional(),
      district: z.string().max(100).optional(),
      districtAr: z.string().max(100).optional(),
      address: z.string().optional(),
      addressAr: z.string().optional(),
      googleMapsUrl: z.string().url().optional().or(z.literal("")),
      propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]).optional(),
      bedrooms: z.number().min(0).max(20).optional(),
      bathrooms: z.number().min(0).max(20).optional(),
      sizeSqm: z.number().min(0).max(100000).optional(),
      furnishedLevel: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).optional(),
      desiredMonthlyRent: z.string().optional(),
      notes: z.string().max(2000).optional(),
      notesAr: z.string().max(2000).optional(),
      photos: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 5 submissions per IP per hour
      const ip = getClientIP(ctx.req);
      const rl = rateLimiter.check(`submission:${ip}`, 5, 3600000);
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many submissions. Please try again later." });

      const { photos, ...submissionData } = input;
      const id = await db.createPropertySubmission({
        ...submissionData,
        desiredMonthlyRent: input.desiredMonthlyRent || undefined,
        status: "new",
        source: "web",
      } as any);

      // Link photos if provided
      if (photos && photos.length > 0 && id) {
        for (let i = 0; i < photos.length; i++) {
          await db.addSubmissionPhoto({
            submissionId: id,
            url: photos[i],
            sortOrder: i,
          } as any);
        }
      }

      return { success: true, id };
    }),

  // ─── Public: Upload Submission Photo ──────────────────────────────
  uploadPhoto: publicProcedure
    .input(z.object({
      base64: z.string().max(MAX_BASE64_SIZE),
      filename: z.string().max(255),
      contentType: z.string().max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit photo uploads
      const ip = getClientIP(ctx.req);
      const rl = rateLimiter.check(`submission-photo:${ip}`, 30, 3600000);
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many uploads." });

      if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file type. Only images allowed." });
      }

      const buffer = Buffer.from(input.base64, "base64");
      const basePath = `submissions/${nanoid(8)}`;

      try {
        const optimized = await optimizeImage(buffer, basePath, input.filename);
        return {
          url: optimized.original.url,
          thumbnail: optimized.thumbnail.url,
          medium: optimized.medium.url,
        };
      } catch (err) {
        console.error("[SubmissionPhoto] Optimization failed:", err);
        const ext = input.filename.split(".").pop() || "jpg";
        const key = `${basePath}/${nanoid()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }
    }),

  // ─── Admin: List Submissions ──────────────────────────────────────
  list: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getAllPropertySubmissions(
        input.limit ?? 50,
        input.offset ?? 0,
        input.status,
        input.search,
      );
    }),

  // ─── Admin: Get Single Submission ─────────────────────────────────
  getById: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const submission = await db.getPropertySubmissionById(input.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      const photos = await db.getSubmissionPhotosBySubmissionId(input.id);
      return { ...submission, photos };
    }),

  // ─── Admin: Update Submission Status ──────────────────────────────
  updateStatus: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "contacted", "approved", "rejected"]),
      internalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const submission = await db.getPropertySubmissionById(input.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      await db.updatePropertySubmission(input.id, {
        status: input.status,
        internalNotes: input.internalNotes ?? submission.internalNotes,
      } as any);
      return { success: true };
    }),

  // ─── Admin: Get Submission Counts ─────────────────────────────────
  counts: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES).query(async () => {
    const [total, newCount, contacted, approved, rejected] = await Promise.all([
      db.getPropertySubmissionCount(),
      db.getPropertySubmissionCount("new"),
      db.getPropertySubmissionCount("contacted"),
      db.getPropertySubmissionCount("approved"),
      db.getPropertySubmissionCount("rejected"),
    ]);
    return { total, new: newCount, contacted, approved, rejected };
  }),

  // ─── Admin: Convert Submission → Property ─────────────────────────
  convertToProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      submissionId: z.number(),
      // Allow admin to override/supplement data during conversion
      titleEn: z.string().min(1),
      titleAr: z.string().min(1),
      descriptionEn: z.string().optional(),
      descriptionAr: z.string().optional(),
      monthlyRent: z.string(),
      status: z.enum(["draft", "pending"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const submission = await db.getPropertySubmissionById(input.submissionId);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      if (submission.convertedPropertyId) {
        throw new TRPCError({ code: "CONFLICT", message: "Submission already converted to property" });
      }

      // Get submission photos
      const photos = await db.getSubmissionPhotosBySubmissionId(input.submissionId);
      const photoUrls = photos.map(p => p.url);

      // Create property from submission data
      const propertyId = await db.createProperty({
        landlordId: ctx.user!.id,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        descriptionEn: input.descriptionEn || submission.notes || "",
        descriptionAr: input.descriptionAr || submission.notesAr || "",
        propertyType: submission.propertyType || "apartment",
        status: input.status || "draft",
        city: submission.city,
        cityAr: submission.cityAr,
        district: submission.district,
        districtAr: submission.districtAr,
        address: submission.address,
        addressAr: submission.addressAr,
        googleMapsUrl: submission.googleMapsUrl,
        bedrooms: submission.bedrooms || 1,
        bathrooms: submission.bathrooms || 1,
        sizeSqm: submission.sizeSqm,
        furnishedLevel: submission.furnishedLevel || "unfurnished",
        monthlyRent: input.monthlyRent || String(submission.desiredMonthlyRent || "0"),
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      } as any);

      if (!propertyId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create property" });

      // Update submission with conversion tracking
      await db.updatePropertySubmission(input.submissionId, {
        status: "approved",
        convertedPropertyId: propertyId,
        convertedBy: ctx.user!.id,
        convertedAt: new Date(),
      } as any);

      // Invalidate caches
      cache.invalidatePrefix("property:");
      cache.invalidatePrefix("search:");

      return { success: true, propertyId };
    }),

  // ─── Admin: Upload Photo for Property (Admin Create/Edit) ────────
  adminUploadPropertyPhoto: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      base64: z.string().max(MAX_BASE64_SIZE),
      filename: z.string().max(255),
      contentType: z.string().max(100),
    }))
    .mutation(async ({ input }) => {
      if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file type. Only images allowed." });
      }

      const buffer = Buffer.from(input.base64, "base64");
      const basePath = `properties/admin/${nanoid(8)}`;

      try {
        const optimized = await optimizeImage(buffer, basePath, input.filename);
        return {
          url: optimized.original.url,
          thumbnail: optimized.thumbnail.url,
          medium: optimized.medium.url,
          variants: optimized,
        };
      } catch (err) {
        console.error("[AdminPropertyPhoto] Optimization failed:", err);
        const ext = input.filename.split(".").pop() || "jpg";
        const key = `${basePath}/${nanoid()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }
    }),

  // ─── Admin: Create Property (Full CRUD) ───────────────────────────
  adminCreateProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      titleEn: z.string().min(1),
      titleAr: z.string().min(1),
      descriptionEn: z.string().optional(),
      descriptionAr: z.string().optional(),
      propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]),
      status: z.enum(["draft", "pending", "active", "inactive", "rejected", "published", "archived"]).optional(),
      city: z.string().optional(),
      cityAr: z.string().optional(),
      district: z.string().optional(),
      districtAr: z.string().optional(),
      address: z.string().optional(),
      addressAr: z.string().optional(),
      googleMapsUrl: z.string().optional(),
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
      // Sanitize: convert empty strings to null for decimal/optional DB columns
      const clean: Record<string, any> = { ...input };
      const optionalStringFields = [
        'descriptionEn','descriptionAr','city','cityAr','district','districtAr',
        'address','addressAr','googleMapsUrl','latitude','longitude',
        'securityDeposit','houseRules','houseRulesAr','videoUrl',
      ];
      for (const k of optionalStringFields) {
        if (clean[k] === '' || clean[k] === undefined) clean[k] = null;
      }
      // Ensure numeric 0 doesn't go into optional int columns as falsy
      if (clean.sizeSqm === 0) clean.sizeSqm = null;
      if (clean.floor === 0) clean.floor = null;
      if (clean.totalFloors === 0) clean.totalFloors = null;
      const id = await db.createProperty({
        ...clean,
        landlordId: ctx.user!.id,
        status: input.status || "draft",
        pricingSource: 'PROPERTY',
      } as any);
      cache.invalidatePrefix("property:");
      cache.invalidatePrefix("search:");
      return { success: true, id };
    }),

  // ─── Admin: Update Property ───────────────────────────────────────
  adminUpdateProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({
      id: z.number(),
      titleEn: z.string().optional(),
      titleAr: z.string().optional(),
      descriptionEn: z.string().optional(),
      descriptionAr: z.string().optional(),
      propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]).optional(),
      status: z.enum(["draft", "pending", "active", "inactive", "rejected", "published", "archived"]).optional(),
      city: z.string().optional(),
      cityAr: z.string().optional(),
      district: z.string().optional(),
      districtAr: z.string().optional(),
      address: z.string().optional(),
      addressAr: z.string().optional(),
      googleMapsUrl: z.string().optional(),
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const prop = await db.getPropertyById(id);
      if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      try {
        // Clean empty strings for decimal/numeric fields to avoid MySQL errors
        const cleaned: any = { ...data };
        if (cleaned.latitude === "") cleaned.latitude = null;
        if (cleaned.longitude === "") cleaned.longitude = null;
        if (cleaned.monthlyRent === "") delete cleaned.monthlyRent;
        if (cleaned.securityDeposit === "") cleaned.securityDeposit = null;
        if (cleaned.videoUrl === "") cleaned.videoUrl = null;
        if (cleaned.googleMapsUrl === "") cleaned.googleMapsUrl = null;
        console.log(`[AdminUpdate] Updating property ${id} with keys:`, Object.keys(cleaned));
        await db.updateProperty(id, cleaned as any);
      } catch (err: any) {
        console.error(`[AdminUpdate] Failed to update property ${id}:`, err?.message, err?.code, err?.sqlMessage);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `فشل تحديث العقار: ${err?.sqlMessage || err?.message || 'Unknown error'}` });
      }
      cache.invalidatePrefix("property:");
      cache.invalidatePrefix("search:");
      return { success: true };
    }),

  // ─── Admin: Delete Property ───────────────────────────────────────
  adminDeleteProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteProperty(input.id);
      cache.invalidatePrefix("property:");
      cache.invalidatePrefix("search:");
      return { success: true };
    }),

  // ─── Admin: Get Single Property for Edit ──────────────────────────
  adminGetProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const prop = await db.getPropertyById(input.id);
      if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      return prop;
    }),
});
