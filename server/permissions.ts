/**
 * Permission enforcement for admin endpoints.
 * Checks user's assigned permissions from adminPermissions table.
 * Root admins (isRootAdmin=true in DB) bypass all permission checks.
 * No external OWNER_OPEN_ID env var is used.
 */
import { getAdminPermissions } from "./db";

// All available permission keys
export const PERMISSIONS = {
  MANAGE_USERS: "manage_users",
  MANAGE_PROPERTIES: "manage_properties",
  MANAGE_BOOKINGS: "manage_bookings",
  MANAGE_PAYMENTS: "manage_payments",
  MANAGE_SERVICES: "manage_services",
  MANAGE_MAINTENANCE: "manage_maintenance",
  MANAGE_CITIES: "manage_cities",
  MANAGE_CMS: "manage_cms",
  MANAGE_ROLES: "manage_roles",
  MANAGE_KNOWLEDGE: "manage_knowledge",
  VIEW_ANALYTICS: "view_analytics",
  MANAGE_SETTINGS: "manage_settings",
  SEND_NOTIFICATIONS: "send_notifications",
  MANAGE_AI: "manage_ai",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Permission categories for UI display
export const PERMISSION_CATEGORIES = [
  {
    key: "users",
    labelAr: "إدارة المستخدمين",
    labelEn: "User Management",
    permissions: [PERMISSIONS.MANAGE_USERS],
  },
  {
    key: "properties",
    labelAr: "إدارة العقارات",
    labelEn: "Property Management",
    permissions: [PERMISSIONS.MANAGE_PROPERTIES],
  },
  {
    key: "bookings",
    labelAr: "إدارة الحجوزات",
    labelEn: "Booking Management",
    permissions: [PERMISSIONS.MANAGE_BOOKINGS, PERMISSIONS.MANAGE_PAYMENTS],
  },
  {
    key: "services",
    labelAr: "إدارة الخدمات والصيانة",
    labelEn: "Services & Maintenance",
    permissions: [PERMISSIONS.MANAGE_SERVICES, PERMISSIONS.MANAGE_MAINTENANCE],
  },
  {
    key: "content",
    labelAr: "إدارة المحتوى",
    labelEn: "Content Management",
    permissions: [PERMISSIONS.MANAGE_CMS, PERMISSIONS.MANAGE_CITIES, PERMISSIONS.MANAGE_KNOWLEDGE],
  },
  {
    key: "system",
    labelAr: "إدارة النظام",
    labelEn: "System Administration",
    permissions: [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_AI],
  },
];

// Cache permissions for 60 seconds to reduce DB hits
const permCache = new Map<number, { perms: string[]; isRoot: boolean; ts: number }>();
const CACHE_TTL = 60_000;

export async function getUserPermissions(userId: number): Promise<{ permissions: string[]; isRoot: boolean }> {
  const cached = permCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { permissions: cached.perms, isRoot: cached.isRoot };
  }

  const result = await getAdminPermissions(userId);
  if (!result) {
    return { permissions: [], isRoot: false };
  }

  const perms = Array.isArray(result.permissions)
    ? result.permissions
    : typeof result.permissions === "string"
      ? JSON.parse(result.permissions as string)
      : [];
  const isRoot = result.isRootAdmin ?? false;

  permCache.set(userId, { perms, isRoot, ts: Date.now() });
  return { permissions: perms, isRoot };
}

/**
 * Check if a user has a specific permission.
 * Root admins (isRootAdmin=true in adminPermissions table) always pass.
 */
export async function hasPermission(userId: number, permission: PermissionKey): Promise<boolean> {
  const { permissions, isRoot } = await getUserPermissions(userId);
  if (isRoot) return true;
  return permissions.includes(permission);
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export async function hasAnyPermission(userId: number, perms: PermissionKey[]): Promise<boolean> {
  const { permissions, isRoot } = await getUserPermissions(userId);
  if (isRoot) return true;
  return perms.some(p => permissions.includes(p));
}

/**
 * Clear permission cache for a user (call after role assignment changes)
 */
export function clearPermissionCache(userId?: number) {
  if (userId) {
    permCache.delete(userId);
  } else {
    permCache.clear();
  }
}
