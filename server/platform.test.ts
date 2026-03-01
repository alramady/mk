import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getAdminPermissions: vi.fn().mockResolvedValue({ id: 1, userId: 1, permissions: ["manage_users", "manage_properties", "manage_bookings", "manage_payments", "manage_services", "manage_maintenance", "manage_settings", "manage_ai", "view_analytics", "manage_roles", "manage_cities", "manage_cms", "manage_knowledge", "send_notifications"], isRootAdmin: true, createdAt: new Date(), updatedAt: new Date() }),
  searchProperties: vi.fn().mockResolvedValue([]),
  getPropertyById: vi.fn().mockResolvedValue(null),
  createProperty: vi.fn().mockResolvedValue(1),
  updateProperty: vi.fn().mockResolvedValue(undefined),
  deleteProperty: vi.fn().mockResolvedValue(undefined),
  incrementPropertyViews: vi.fn().mockResolvedValue(undefined),
  getPropertiesByLandlord: vi.fn().mockResolvedValue([]),
  getPropertyAvailability: vi.fn().mockResolvedValue([]),
  setPropertyAvailability: vi.fn().mockResolvedValue(undefined),
  getReviewsByProperty: vi.fn().mockResolvedValue([]),
  getAverageRating: vi.fn().mockResolvedValue(0),
  isFavorite: vi.fn().mockResolvedValue(false),
  addFavorite: vi.fn().mockResolvedValue(undefined),
  removeFavorite: vi.fn().mockResolvedValue(undefined),
  getUserFavorites: vi.fn().mockResolvedValue([]),
  createBooking: vi.fn().mockResolvedValue(1),
  getBookingById: vi.fn().mockResolvedValue(null),
  updateBooking: vi.fn().mockResolvedValue(undefined),
  getBookingsByTenant: vi.fn().mockResolvedValue([]),
  getBookingsByLandlord: vi.fn().mockResolvedValue([]),
  createPayment: vi.fn().mockResolvedValue(1),
  getPaymentsByTenant: vi.fn().mockResolvedValue([]),
  getPaymentsByLandlord: vi.fn().mockResolvedValue([]),
  getPaymentsByBooking: vi.fn().mockResolvedValue([]),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 1 }),
  createMessage: vi.fn().mockResolvedValue(1),
  getUnreadMessageCount: vi.fn().mockResolvedValue(0),
  createMaintenanceRequest: vi.fn().mockResolvedValue(1),
  getMaintenanceById: vi.fn().mockResolvedValue(null),
  updateMaintenanceRequest: vi.fn().mockResolvedValue(undefined),
  getMaintenanceByTenant: vi.fn().mockResolvedValue([]),
  getMaintenanceByLandlord: vi.fn().mockResolvedValue([]),
  getNotificationsByUser: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  createNotification: vi.fn().mockResolvedValue(1),
  createReview: vi.fn().mockResolvedValue(1),
  createSavedSearch: vi.fn().mockResolvedValue(1),
  getSavedSearches: vi.fn().mockResolvedValue([]),
  deleteSavedSearch: vi.fn().mockResolvedValue(undefined),
  getUserCount: vi.fn().mockResolvedValue(10),
  getPropertyCount: vi.fn().mockResolvedValue(5),
  getBookingCount: vi.fn().mockResolvedValue(3),
  getTotalRevenue: vi.fn().mockResolvedValue("50000"),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllProperties: vi.fn().mockResolvedValue([]),
  getAllBookings: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(role: "user" | "admin" = "user"): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Auth Router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-123");
    expect(result?.name).toBe("Test User");
  });

  it("clears cookie on logout", async () => {
    const { ctx, clearedCookies } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("Property Router", () => {
  it("searches properties with default params", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.property.search({});
    expect(result).toEqual([]);
  });

  it("searches properties with filters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.property.search({
      city: "Riyadh",
      minPrice: 2000,
      maxPrice: 5000,
      propertyType: "apartment",
      bedrooms: 2,
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns null for non-existent property", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.property.getById({ id: 999 });
    expect(result).toBeNull();
  });

  it("gets property reviews", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.property.getReviews({ propertyId: 1 });
    expect(result).toHaveProperty("reviews");
    expect(result).toHaveProperty("avgRating");
  });
});

describe("Booking Router", () => {
  it("lists user bookings", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.booking.myBookings();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists landlord bookings", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.booking.landlordBookings();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects booking creation for non-existent property", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.booking.create({
        propertyId: 999,
        moveInDate: "2026-04-01",
        moveOutDate: "2026-10-01",
        durationMonths: 6,
      })
    ).rejects.toThrow("Property not found");
  });
});

describe("Favorite Router", () => {
  it("lists user favorites", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.favorite.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("checks favorite status", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.favorite.check({ propertyId: 1 });
    expect(result).toHaveProperty("isFavorite");
    expect(result.isFavorite).toBe(false);
  });

  it("toggles favorite", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.favorite.toggle({ propertyId: 1 });
    expect(result).toHaveProperty("isFavorite");
  });
});

describe("Message Router", () => {
  it("lists conversations", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.message.getConversations();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Maintenance Router", () => {
  it("lists user maintenance requests", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.maintenance.myRequests();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists landlord maintenance requests", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.maintenance.landlordRequests();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Payment Router", () => {
  it("lists user payments", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payment.myPayments();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists landlord payments", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payment.landlordPayments();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Notification Router", () => {
  it("lists user notifications", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notification.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Admin Router", () => {
  it("returns stats for admin", async () => {
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.stats();
    expect(result).toHaveProperty("userCount");
    expect(result).toHaveProperty("activeProperties");
    expect(result).toHaveProperty("pendingProperties");
    expect(result).toHaveProperty("totalRevenue");
  });

  it("rejects non-admin from stats", async () => {
    const { ctx } = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("lists users for admin", async () => {
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.users({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists properties for admin", async () => {
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.properties({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists bookings for admin", async () => {
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.bookings({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});
