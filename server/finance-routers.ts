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
import { logAudit, computeChanges, getAuditLog } from "./audit-log";

/** Helper to get userName from ctx, converting null to undefined */
function auditUserName(ctx: { user?: { name?: string | null; email?: string | null } | null }): string | undefined {
  return ctx.user?.name ?? ctx.user?.email ?? undefined;
}

export const financeRouter = router({
  // ─── Buildings ──────────────────────────────────────────────────────
  buildings: router({
    list: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ isActive: z.boolean().optional(), includeArchived: z.boolean().optional(), limit: z.number().optional(), offset: z.number().optional() }).optional())
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
      .mutation(async ({ ctx, input }) => {
        const id = await finance.createBuilding(input);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "CREATE", entityType: "BUILDING", entityId: id,
          entityLabel: input.buildingName,
        });
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
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        totalUnits: z.number().optional(),
        managerId: z.number().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const oldBuilding = await finance.getBuildingById(id);
        await finance.updateBuilding(id, data);
        if (oldBuilding) {
          const changes = computeChanges(oldBuilding as any, data as any,
            ["buildingName","buildingNameAr","address","city","district","latitude","longitude","totalUnits","notes","isActive"]
          );
          if (changes) {
            await logAudit({
              userId: ctx.user?.id, userName: auditUserName(ctx),
              action: "UPDATE", entityType: "BUILDING", entityId: id,
              entityLabel: oldBuilding.buildingName, changes,
            });
          }
        }
        return { success: true };
      }),
    archive: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const building = await finance.getBuildingById(input.id);
        const result = await finance.archiveBuilding(input.id);
        if (result.success) {
          await logAudit({
            userId: ctx.user?.id, userName: auditUserName(ctx),
            action: "ARCHIVE", entityType: "BUILDING", entityId: input.id,
            entityLabel: building?.buildingName,
          });
        }
        return result;
      }),
    restore: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await finance.restoreBuilding(input.id);
        const building = await finance.getBuildingById(input.id);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "RESTORE", entityType: "BUILDING", entityId: input.id,
          entityLabel: building?.buildingName,
        });
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
    availableForLinking: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ propertyId: z.number().optional() }))
      .query(async ({ input }) => {
        return finance.getAvailableUnitsForLinking(input.propertyId);
      }),
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
      .mutation(async ({ ctx, input }) => {
        // P0 Fix: Validate monthly rent is provided and > 0
        if (!input.monthlyBaseRentSAR || Number(input.monthlyBaseRentSAR) <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Monthly rent (monthlyBaseRentSAR) is required and must be greater than 0." });
        }
        // Validate unique unit number within building
        const isUnique = await finance.isUnitNumberUnique(input.buildingId, input.unitNumber);
        if (!isUnique) {
          throw new TRPCError({ code: "CONFLICT", message: `Unit number "${input.unitNumber}" already exists in this building.` });
        }
        const id = await finance.createUnit(input);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "CREATE", entityType: "UNIT", entityId: id,
          entityLabel: `Unit ${input.unitNumber}`,
          metadata: { buildingId: input.buildingId },
        });
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
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const oldUnit = await finance.getUnitById(id);
        // Validate unique unit number if changing
        if (data.unitNumber && oldUnit) {
          const isUnique = await finance.isUnitNumberUnique(oldUnit.buildingId, data.unitNumber, id);
          if (!isUnique) {
            throw new TRPCError({ code: "CONFLICT", message: `Unit number "${data.unitNumber}" already exists in this building.` });
          }
        }
        await finance.updateUnit(id, data);
        if (oldUnit) {
          const changes = computeChanges(oldUnit as any, data as any,
            ["unitNumber","floor","bedrooms","bathrooms","sizeSqm","unitStatus","monthlyBaseRentSAR","notes"]
          );
          if (changes) {
            await logAudit({
              userId: ctx.user?.id, userName: auditUserName(ctx),
              action: "UPDATE", entityType: "UNIT", entityId: id,
              entityLabel: `Unit ${oldUnit.unitNumber}`, changes,
              metadata: { buildingId: oldUnit.buildingId },
            });
          }
        }
        return { success: true };
      }),
    archive: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const unit = await finance.getUnitById(input.id);
        const result = await finance.archiveUnit(input.id);
        if (result.success) {
          await logAudit({
            userId: ctx.user?.id, userName: auditUserName(ctx),
            action: "ARCHIVE", entityType: "UNIT", entityId: input.id,
            entityLabel: `Unit ${unit?.unitNumber}`,
            metadata: { buildingId: unit?.buildingId },
          });
        }
        return result;
      }),
    restore: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await finance.restoreUnit(input.id);
        const unit = await finance.getUnitById(input.id);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "RESTORE", entityType: "UNIT", entityId: input.id,
          entityLabel: `Unit ${unit?.unitNumber}`,
          metadata: { buildingId: unit?.buildingId },
        });
        return { success: true };
      }),
    checkUniqueNumber: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ buildingId: z.number(), unitNumber: z.string(), excludeUnitId: z.number().optional() }))
      .query(async ({ input }) => {
        return { isUnique: await finance.isUnitNumberUnique(input.buildingId, input.unitNumber, input.excludeUnitId) };
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
    linkToProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ unitId: z.number(), propertyId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const unit = await finance.getUnitById(input.unitId);
        if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unit not found' });
        await finance.updateUnit(input.unitId, { propertyId: input.propertyId as any });
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: 'LINK', entityType: 'UNIT', entityId: input.unitId,
          entityLabel: `Unit ${unit.unitNumber} → Property ${input.propertyId}`,
          metadata: { propertyId: input.propertyId },
        });
        return { success: true };
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

  // ─── Beds24 Connections ────────────────────────────────────────────
  beds24: router({
    /** List all Beds24 mappings with connection type info */
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ connectionType: z.enum(["API", "ICAL"]).optional() }).optional())
      .query(async ({ input }) => {
        return finance.getBeds24Mappings(input?.connectionType);
      }),
    /** Create or update a Beds24 mapping for a unit */
    upsert: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        unitId: z.number(),
        beds24PropertyId: z.string().optional(),
        beds24RoomId: z.string().optional(),
        connectionType: z.enum(["API", "ICAL"]),
        icalImportUrl: z.string().optional(),
        icalExportUrl: z.string().optional(),
        beds24ApiKey: z.string().optional(),
        sourceOfTruth: z.enum(["BEDS24", "LOCAL"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await finance.upsertBeds24Mapping(input);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "LINK_BEDS24", entityType: "BEDS24_MAP", entityId: result.id,
          entityLabel: `Unit ${input.unitId} → Beds24 ${input.beds24PropertyId || ''}/${input.beds24RoomId || ''}`,
          metadata: { unitId: input.unitId, connectionType: input.connectionType },
        });
        return result;
      }),
    /** Delete a Beds24 mapping */
    delete: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await finance.deleteBeds24Mapping(input.id);
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "UNLINK_BEDS24", entityType: "BEDS24_MAP", entityId: input.id,
        });
        return result;
      }),
    /** Get mapping by unit ID */
    byUnit: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ unitId: z.number() }))
      .query(async ({ input }) => {
        return finance.getBeds24MapByUnit(input.unitId);
      }),
    /** Get connection stats (API vs iCal counts, sync status) */
    stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .query(async () => {
        return occupancy.getConnectionStats();
      }),
    /** Sync a single iCal unit */
    syncUnit: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ unitId: z.number() }))
      .mutation(async ({ input }) => {
        return occupancy.syncICalUnit(input.unitId);
      }),
    /** Sync all iCal units */
    syncAllICal: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .mutation(async () => {
        return occupancy.syncAllICalUnits();
      }),
  }),

  // ─── Audit Log ────────────────────────────────────────────────────
  auditLog: router({
    list: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({
        entityType: z.enum(["BUILDING","UNIT","BEDS24_MAP","LEDGER","EXTENSION","PAYMENT_METHOD"]).optional(),
        entityId: z.number().optional(),
        userId: z.number().optional(),
        action: z.enum(["CREATE","UPDATE","ARCHIVE","RESTORE","DELETE","LINK_BEDS24","UNLINK_BEDS24"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getAuditLog(input || {});
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

  // ─── Moyasar Payment ──────────────────────────────────────────────
  moyasarPayment: router({
    // Get available payment methods (public — used by checkout page)
    getAvailableMethods: publicProcedure
      .query(async () => {
        const { getAvailablePaymentMethods } = await import("./moyasar");
        return getAvailablePaymentMethods();
      }),
    // Get enabled payment method badges (public — used by footer + property page)
    getEnabledBadges: publicProcedure
      .query(async () => {
        const { getEnabledPaymentMethodsForBadges } = await import("./moyasar");
        return getEnabledPaymentMethodsForBadges();
      }),
    // Get Moyasar configuration status (admin only)
    getConfigStatus: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        const { getMoyasarConfigStatus } = await import("./moyasar");
        return getMoyasarConfigStatus();
      }),
    // Get Moyasar settings (admin only)
    getSettings: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        const { getMoyasarSettings } = await import("./moyasar");
        return getMoyasarSettings();
      }),
    // Save Moyasar settings (admin only)
    saveSettings: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        publishableKey: z.string(),
        secretKey: z.string(),
        webhookSecret: z.string(),
        mode: z.enum(["test", "live"]),
        enabled: z.boolean(),
        enableMadaCards: z.boolean(),
        enableApplePay: z.boolean(),
        enableGooglePay: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const dbModule = await import("./db");
        await dbModule.setSetting("moyasar.publishableKey", input.publishableKey);
        await dbModule.setSetting("moyasar.secretKey", input.secretKey);
        await dbModule.setSetting("moyasar.webhookSecret", input.webhookSecret);
        await dbModule.setSetting("moyasar.mode", input.mode);
        await dbModule.setSetting("moyasar.enabled", String(input.enabled));
        await dbModule.setSetting("moyasar.enableMadaCards", String(input.enableMadaCards));
        await dbModule.setSetting("moyasar.enableApplePay", String(input.enableApplePay));
        await dbModule.setSetting("moyasar.enableGooglePay", String(input.enableGooglePay));
        await logAudit({
          userId: ctx.user?.id, userName: auditUserName(ctx),
          action: "UPDATE", entityType: "PAYMENT_METHOD", entityId: 0,
          entityLabel: "Moyasar Settings",
          metadata: { enabled: input.enabled, mode: input.mode },
        });
        return { success: true };
      }),
    // Create a Moyasar payment (protected — tenant creates payment)
    createPayment: protectedProcedure
      .input(z.object({
        ledgerId: z.number(),
        callbackUrl: z.string(),
        sourceType: z.enum(["creditcard", "applepay", "googlepay"]),
        token: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Ledger is the ONLY source of truth for amount
        const { getLedgerEntry } = await import("./finance-registry");
        const ledger = await getLedgerEntry(input.ledgerId);
        if (!ledger) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ledger entry not found' });
        if (ledger.status !== 'DUE') throw new TRPCError({ code: 'BAD_REQUEST', message: `Ledger status is ${ledger.status}, expected DUE` });
        
        // Validate booking status = approved
        const booking = ledger.bookingId ? await db.getBookingById(ledger.bookingId) : null;
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked booking not found' });
        if (booking.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: `Booking status is ${booking.status}, expected approved` });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the tenant can pay for this booking' });
        
        // Payment config must be active
        const { isPaymentConfigured } = await import("./finance-registry");
        const pc = await isPaymentConfigured();
        if (!pc.configured) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment provider not configured' });
        
        const { createMoyasarPayment } = await import("./moyasar");
        return createMoyasarPayment({
          bookingId: booking.id,
          amount: Number(ledger.amount), // Ledger amount is the source of truth
          description: `Rent payment for booking #${booking.id} - Invoice ${ledger.invoiceNumber}`,
          callbackUrl: input.callbackUrl,
          source: {
            type: input.sourceType,
            token: input.token,
          },
          metadata: {
            bookingId: String(booking.id),
            ledgerId: String(ledger.id),
            invoiceNumber: ledger.invoiceNumber || '',
          },
        });
      }),
    // Fetch payment status from Moyasar (admin reconciliation)
    fetchStatus: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ paymentRef: z.string() }))
      .query(async ({ input }) => {
        const { fetchMoyasarPaymentStatus } = await import("./moyasar");
        return fetchMoyasarPaymentStatus(input.paymentRef);
      }),
  }),

  // ─── Geocode (Reverse Geocode from lat/lng) ──────────────────────
  geocode: router({
    reverse: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ lat: z.string(), lng: z.string() }))
      .query(async ({ input }) => {
        const { makeRequest } = await import("./_core/map");
        // Fetch English result
        const enResult = await makeRequest<any>("/maps/api/geocode/json", {
          latlng: `${input.lat},${input.lng}`,
          language: "en",
          region: "SA",
        });
        // Fetch Arabic result
        const arResult = await makeRequest<any>("/maps/api/geocode/json", {
          latlng: `${input.lat},${input.lng}`,
          language: "ar",
          region: "SA",
        });
        const parseComponents = (result: any) => {
          if (!result?.results?.[0]) return { city: "", district: "", address: "" };
          const components = result.results[0].address_components || [];
          let city = "", district = "", address = result.results[0].formatted_address || "";
          for (const c of components) {
            if (c.types.includes("locality") || c.types.includes("administrative_area_level_2")) {
              city = city || c.long_name;
            }
            if (c.types.includes("sublocality_level_1") || c.types.includes("sublocality") || c.types.includes("neighborhood")) {
              district = district || c.long_name;
            }
          }
          return { city, district, address };
        };
        const en = parseComponents(enResult);
        const ar = parseComponents(arResult);
        return {
          city: en.city, cityAr: ar.city,
          district: en.district, districtAr: ar.district,
          address: en.address, addressAr: ar.address,
          latitude: input.lat, longitude: input.lng,
        };
      }),
  }),
});
