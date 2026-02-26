/**
 * Finance Registry tRPC Routers
 * 
 * All routes for buildings, units, payment ledger, KPIs, renewals,
 * payment method settings, and occupancy.
 * 
 * Imported into the main appRouter in routers.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, adminWithPermission, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import * as finance from "./finance-registry";
import * as occupancy from "./occupancy";
import * as renewal from "./renewal";

export const financeRouter = router({
  // ─── Buildings ──────────────────────────────────────────────────────
  buildings: router({
    list: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ isActive: z.boolean().optional(), limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return finance.getBuildings(input || {});
      }),
    getById: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return finance.getBuildingById(input.id);
      }),
    create: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        buildingName: z.string().min(1),
        buildingNameAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        totalUnits: z.number().optional(),
        managerId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await finance.createBuilding(input);
        return { id };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        id: z.number(),
        buildingName: z.string().optional(),
        buildingNameAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        totalUnits: z.number().optional(),
        managerId: z.number().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await finance.updateBuilding(id, data);
        return { success: true };
      }),
    kpis: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ buildingId: z.number() }))
      .query(async ({ input }) => {
        return finance.getBuildingKPIs(input.buildingId);
      }),
    unitsWithFinance: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ buildingId: z.number() }))
      .query(async ({ input }) => {
        return finance.getBuildingUnitsWithFinance(input.buildingId);
      }),
    occupancyRate: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ buildingId: z.number(), days: z.number().optional() }))
      .query(async ({ input }) => {
        return occupancy.getBuildingOccupancyRate(input.buildingId, input.days || 30);
      }),
  }),

  // ─── Units ──────────────────────────────────────────────────────────
  units: router({
    byBuilding: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ buildingId: z.number() }))
      .query(async ({ input }) => {
        return finance.getUnitsByBuilding(input.buildingId);
      }),
    getById: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return finance.getUnitById(input.id);
      }),
    create: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        buildingId: z.number(),
        unitNumber: z.string().min(1),
        floor: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        unitStatus: z.string().optional(),
        monthlyBaseRentSAR: z.string().optional(),
        propertyId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await finance.createUnit(input);
        return { id };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        id: z.number(),
        unitNumber: z.string().optional(),
        floor: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        unitStatus: z.string().optional(),
        monthlyBaseRentSAR: z.string().optional(),
        propertyId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await finance.updateUnit(id, data);
        return { success: true };
      }),
    financeDetails: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ unitId: z.number() }))
      .query(async ({ input }) => {
        return finance.getUnitFinanceDetails(input.unitId);
      }),
    occupancyStatus: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ unitId: z.number() }))
      .query(async ({ input }) => {
        return occupancy.isUnitOccupied(input.unitId);
      }),
  }),

  // ─── Payment Ledger ─────────────────────────────────────────────────
  ledger: router({
    search: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({
        buildingId: z.number().optional(),
        unitId: z.number().optional(),
        unitNumber: z.string().optional(),
        customerId: z.number().optional(),
        guestNameOrPhone: z.string().optional(),
        bookingId: z.number().optional(),
        beds24BookingId: z.string().optional(),
        invoiceNumber: z.string().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        paymentMethod: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return finance.searchLedger(input);
      }),
    getById: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return finance.getLedgerEntry(input.id);
      }),
    create: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({
        bookingId: z.number().optional(),
        beds24BookingId: z.string().optional(),
        customerId: z.number().optional(),
        guestName: z.string().optional(),
        guestEmail: z.string().optional(),
        guestPhone: z.string().optional(),
        buildingId: z.number().optional(),
        unitId: z.number().optional(),
        unitNumber: z.string().optional(),
        propertyDisplayName: z.string().optional(),
        type: z.enum(["RENT", "RENEWAL_RENT", "PROTECTION_FEE", "DEPOSIT", "CLEANING", "PENALTY", "REFUND", "ADJUSTMENT"]),
        direction: z.enum(["IN", "OUT"]).optional(),
        amount: z.string(),
        currency: z.string().optional(),
        status: z.enum(["DUE", "PENDING", "PAID", "FAILED", "REFUNDED", "VOID"]).optional(),
        paymentMethod: z.string().optional(),
        provider: z.string().optional(),
        dueAt: z.string().optional(),
        notes: z.string().optional(),
        notesAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await finance.createLedgerEntry({
          ...input,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          createdBy: ctx.user!.id,
        });
        return result;
      }),
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({
        id: z.number(),
        status: z.enum(["DUE", "PENDING", "FAILED", "VOID"]),
        paymentMethod: z.string().optional(),
        provider: z.string().optional(),
        providerRef: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Note: PAID status can only be set via webhook. REFUNDED via createAdjustment.
        await finance.updateLedgerStatusSafe(input.id, input.status, {
          paymentMethod: input.paymentMethod,
          provider: input.provider,
          providerRef: input.providerRef,
        });
        return { success: true };
      }),
    createAdjustment: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
      .input(z.object({
        parentLedgerId: z.number(),
        type: z.enum(["REFUND", "ADJUSTMENT"]),
        direction: z.enum(["IN", "OUT"]),
        amount: z.string(),
        notes: z.string().optional(),
        notesAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return finance.createAdjustmentOrRefund(input.parentLedgerId, {
          ...input,
          createdBy: ctx.user!.id,
        });
      }),
  }),

  // ─── KPIs ─────────────────────────────────────────────────────────
  kpis: router({
    global: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .query(async () => {
        return finance.getGlobalKPIs();
      }),
    building: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ buildingId: z.number() }))
      .query(async ({ input }) => {
        return finance.getBuildingKPIs(input.buildingId);
      }),
    occupancy: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        return occupancy.getGlobalOccupancyStats(input?.days || 30);
      }),
  }),

  // ─── Renewals ─────────────────────────────────────────────────────
  renewals: router({
    checkEligibility: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input }) => {
        return renewal.checkRenewalEligibility(input.bookingId);
      }),
    request: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return renewal.requestRenewal(input.bookingId, ctx.user!.id);
      }),
    approve: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({
        extensionId: z.number(),
        beds24ChangeNote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return renewal.approveExtension(input.extensionId, ctx.user!.id, input.beds24ChangeNote);
      }),
    reject: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ extensionId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return renewal.rejectExtension(input.extensionId, ctx.user!.id, input.reason);
      }),
    list: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({
        bookingId: z.number().optional(),
        status: z.string().optional(),
        beds24Only: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return renewal.listExtensions(input || {});
      }),
  }),

  // ─── Payment Methods ──────────────────────────────────────────────
  paymentMethods: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        return finance.getPaymentMethods();
      }),
    enabled: publicProcedure
      .query(async () => {
        return finance.getEnabledPaymentMethods();
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        methodKey: z.string(),
        isEnabled: z.boolean().optional(),
        apiKeyConfigured: z.boolean().optional(),
        configJson: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { methodKey, ...data } = input;
        await finance.updatePaymentMethod(methodKey, data);
        return { success: true };
      }),
  }),

  // ─── Occupancy Snapshot ───────────────────────────────────────────
  snapshot: router({
    generate: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ date: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        return occupancy.generateDailySnapshot(input?.date ? new Date(input.date) : undefined);
      }),
  }),
});
