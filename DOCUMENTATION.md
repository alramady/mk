# المفتاح الشهري — Technical Documentation

**Platform:** Monthly Key (المفتاح الشهري)
**Version:** 1.0.0
**Last Updated:** February 2026
**Author:** Manus AI

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Permission System (RBAC)](#7-permission-system-rbac)
8. [Frontend Pages & Routes](#8-frontend-pages--routes)
9. [Email System](#9-email-system)
10. [Push Notifications](#10-push-notifications)
11. [PWA Support](#11-pwa-support)
12. [AI Assistant](#12-ai-assistant)
13. [City & District Management](#13-city--district-management)
14. [Services & Emergency Maintenance](#14-services--emergency-maintenance)
15. [Analytics Dashboard](#15-analytics-dashboard)
16. [Environment Variables](#16-environment-variables)
17. [Deployment Guide](#17-deployment-guide)
18. [Testing](#18-testing)
19. [Future Enhancements](#19-future-enhancements)

---

## 1. Architecture Overview

The platform follows a **monorepo architecture** with a React frontend and Express/tRPC backend sharing a single codebase. All communication between client and server uses **tRPC** for end-to-end type safety, eliminating the need for manual API contracts or REST route definitions.

```
┌─────────────────────────────────────────────────────┐
│                    Client (React 19)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Pages   │  │Components│  │  tRPC Client      │  │
│  │  (33)    │  │  (UI)    │  │  (Type-safe RPC)  │  │
│  └──────────┘  └──────────┘  └────────┬─────────┘  │
└───────────────────────────────────────┼─────────────┘
                                        │ HTTP /api/trpc
┌───────────────────────────────────────┼─────────────┐
│                 Server (Express + tRPC)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Routers  │  │Middleware│  │  Services         │  │
│  │ (32)     │  │(Auth/RBAC│  │  (Email/Push/AI)  │  │
│  └────┬─────┘  └──────────┘  └──────────────────┘  │
│       │                                             │
│  ┌────┴─────────────────────────────────────────┐   │
│  │         Drizzle ORM + MySQL/TiDB             │   │
│  │              (30 tables)                     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

The request flow is straightforward: the React client calls tRPC procedures through a typed client, which hits the Express server. The server validates input with Zod schemas, checks authentication and permissions via middleware, executes business logic with Drizzle ORM queries, and returns typed responses.

---

## 2. Technology Stack

<table header-row="true">
<tr><td>Layer</td><td>Technology</td><td>Version</td><td>Purpose</td></tr>
<tr><td>Frontend</td><td>React</td><td>19</td><td>UI framework with hooks-based state management</td></tr>
<tr><td>Frontend</td><td>Tailwind CSS</td><td>4</td><td>Utility-first CSS with RTL support</td></tr>
<tr><td>Frontend</td><td>shadcn/ui</td><td>Latest</td><td>Accessible component library</td></tr>
<tr><td>Frontend</td><td>Recharts</td><td>2.x</td><td>Analytics charts and data visualization</td></tr>
<tr><td>Backend</td><td>Express</td><td>4</td><td>HTTP server framework</td></tr>
<tr><td>Backend</td><td>tRPC</td><td>11</td><td>End-to-end type-safe API layer</td></tr>
<tr><td>Backend</td><td>Drizzle ORM</td><td>Latest</td><td>Type-safe SQL query builder</td></tr>
<tr><td>Database</td><td>MySQL/TiDB</td><td>8.x</td><td>Relational database</td></tr>
<tr><td>Auth</td><td>Manus OAuth + JWT</td><td>-</td><td>Authentication with session cookies</td></tr>
<tr><td>Email</td><td>Nodemailer</td><td>6.x</td><td>SMTP email delivery</td></tr>
<tr><td>Push</td><td>web-push</td><td>3.x</td><td>Web Push Notifications (VAPID)</td></tr>
<tr><td>AI</td><td>Manus LLM API</td><td>-</td><td>AI assistant with knowledge base</td></tr>
<tr><td>Build</td><td>Vite</td><td>6.x</td><td>Frontend bundler with HMR</td></tr>
<tr><td>Runtime</td><td>tsx</td><td>Latest</td><td>TypeScript execution for server</td></tr>
<tr><td>Testing</td><td>Vitest</td><td>Latest</td><td>Unit and integration testing</td></tr>
</table>

---

## 3. Project Structure

```
monthly-rental-platform/
├── client/
│   ├── public/                  # Static assets (manifest.json, sw.js, icons)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── AIChatBox.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── SEOHead.tsx
│   │   │   └── CookieConsent.tsx
│   │   ├── contexts/            # React contexts (Auth, Theme)
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/
│   │   │   ├── trpc.ts          # tRPC client configuration
│   │   │   └── analytics.ts     # Google Analytics integration
│   │   ├── pages/               # 33 page components
│   │   ├── App.tsx              # Route definitions
│   │   ├── main.tsx             # App entry point
│   │   └── index.css            # Global styles + Tailwind theme
│   └── index.html               # HTML template
├── drizzle/
│   ├── schema.ts                # All 30 table definitions
│   └── migrations/              # Generated SQL migrations
├── server/
│   ├── _core/                   # Framework internals (DO NOT EDIT)
│   │   ├── context.ts           # tRPC context builder
│   │   ├── env.ts               # Environment variable access
│   │   ├── llm.ts               # LLM integration helper
│   │   ├── notification.ts      # Owner notification helper
│   │   └── oauth.ts             # OAuth flow handler
│   ├── db.ts                    # Database query helpers
│   ├── routers.ts               # All 32 tRPC routers (165 endpoints)
│   ├── permissions.ts           # RBAC permission definitions
│   ├── middleware/
│   │   └── permissions.ts       # Permission checking middleware
│   ├── services/
│   │   └── email.ts             # SMTP email service
│   ├── storage.ts               # S3 file storage helpers
│   └── *.test.ts                # 17 test files (302 tests)
├── shared/                      # Shared types and constants
├── public/                      # Root-level static files
├── DOCUMENTATION.md             # This file
├── todo.md                      # Feature tracking
└── package.json                 # Dependencies and scripts
```

---

## 4. Database Schema

The platform uses **30 MySQL tables** organized into functional domains. All timestamps are stored as UTC. The schema is defined in `drizzle/schema.ts` using Drizzle ORM's type-safe table builders.

### 4.1 Core Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>users</td><td>30</td><td>User accounts with profiles, roles, KYC data, and preferences</td></tr>
<tr><td>properties</td><td>40</td><td>Property listings with bilingual content, location, pricing, amenities</td></tr>
<tr><td>property_availability</td><td>7</td><td>Date-based availability and price overrides per property</td></tr>
<tr><td>favorites</td><td>4</td><td>User-saved favorite properties</td></tr>
</table>

### 4.2 Booking & Payment Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>bookings</td><td>19</td><td>Booking records with status workflow (pending/confirmed/active/completed/cancelled)</td></tr>
<tr><td>payments</td><td>19</td><td>Payment transactions with multi-gateway support (Stripe, PayPal)</td></tr>
<tr><td>lease_contracts</td><td>-</td><td>Generated via lease.generate endpoint from booking data</td></tr>
</table>

### 4.3 Communication Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>conversations</td><td>6</td><td>Messaging threads between tenants and landlords</td></tr>
<tr><td>messages</td><td>8</td><td>Individual messages with file attachment support</td></tr>
<tr><td>notifications</td><td>11</td><td>In-app notifications with bilingual content</td></tr>
<tr><td>push_subscriptions</td><td>6</td><td>Web Push subscription endpoints per user</td></tr>
<tr><td>contact_messages</td><td>8</td><td>Contact form submissions from visitors</td></tr>
</table>

### 4.4 Maintenance & Services Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>maintenance_requests</td><td>19</td><td>Standard maintenance requests from tenants</td></tr>
<tr><td>emergency_maintenance</td><td>19</td><td>Urgent maintenance with technician assignment workflow</td></tr>
<tr><td>maintenance_updates</td><td>7</td><td>Status update log for emergency maintenance cases</td></tr>
<tr><td>platform_services</td><td>12</td><td>Bookable services (cleaning, moving, furniture, etc.)</td></tr>
<tr><td>service_requests</td><td>11</td><td>Tenant requests for platform services</td></tr>
</table>

### 4.5 Reviews & Analytics Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>reviews</td><td>9</td><td>Property reviews with 1-5 star ratings and admin moderation</td></tr>
<tr><td>user_activities</td><td>9</td><td>User activity tracking for analytics</td></tr>
<tr><td>saved_searches</td><td>6</td><td>Saved search filters with alert preferences</td></tr>
</table>

### 4.6 AI & Knowledge Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>ai_conversations</td><td>5</td><td>AI assistant conversation sessions</td></tr>
<tr><td>ai_messages</td><td>6</td><td>Individual AI messages with user ratings</td></tr>
<tr><td>knowledge_base</td><td>10</td><td>Admin-managed knowledge articles for AI context</td></tr>
</table>

### 4.7 Location Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>cities</td><td>13</td><td>Saudi cities with coordinates, images, featured toggle</td></tr>
<tr><td>districts</td><td>12</td><td>Neighborhoods within cities with coordinates</td></tr>
</table>

### 4.8 Administration Tables

<table header-row="true">
<tr><td>Table</td><td>Columns</td><td>Purpose</td></tr>
<tr><td>platform_settings</td><td>5</td><td>Key-value CMS settings (site name, hero content, FAQ, etc.)</td></tr>
<tr><td>admin_permissions</td><td>6</td><td>Per-user permission grants with caching</td></tr>
<tr><td>roles</td><td>10</td><td>Named roles with permission bundles</td></tr>
<tr><td>property_managers</td><td>15</td><td>Property manager profiles with self-edit tokens</td></tr>
<tr><td>property_manager_assignments</td><td>4</td><td>Manager-to-property assignment mapping</td></tr>
<tr><td>inspection_requests</td><td>16</td><td>Property inspection scheduling with time slots</td></tr>
</table>

---

## 5. API Reference

The platform exposes **165 tRPC endpoints** across **32 routers**. All endpoints are accessed via `/api/trpc/{router}.{endpoint}`. Authentication levels are: **public** (no auth), **protected** (logged-in user), **admin** (admin role), and **admin(PERMISSION)** (admin with specific permission).

### 5.1 Authentication Router (`auth`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>auth.me</td><td>query</td><td>public</td><td>Get current user session (returns null if not logged in)</td></tr>
<tr><td>auth.logout</td><td>mutation</td><td>public</td><td>Clear session cookie and log out</td></tr>
<tr><td>auth.getFullProfile</td><td>query</td><td>protected</td><td>Get complete user profile with all fields</td></tr>
<tr><td>auth.updateProfile</td><td>mutation</td><td>protected</td><td>Update user profile fields</td></tr>
<tr><td>auth.uploadAvatar</td><td>mutation</td><td>protected</td><td>Upload user avatar image to S3</td></tr>
<tr><td>auth.uploadIdDocument</td><td>mutation</td><td>protected</td><td>Upload ID document for verification</td></tr>
</table>

### 5.2 Property Router (`property`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>property.create</td><td>mutation</td><td>protected</td><td>Create new property listing</td></tr>
<tr><td>property.update</td><td>mutation</td><td>protected</td><td>Update property details (owner only)</td></tr>
<tr><td>property.delete</td><td>mutation</td><td>protected</td><td>Delete property listing (owner only)</td></tr>
<tr><td>property.getById</td><td>query</td><td>public</td><td>Get single property with all details</td></tr>
<tr><td>property.getByLandlord</td><td>query</td><td>protected</td><td>List properties owned by current user</td></tr>
<tr><td>property.search</td><td>mutation</td><td>public</td><td>Search properties with filters (city, price, type, amenities)</td></tr>
<tr><td>property.featured</td><td>query</td><td>public</td><td>Get featured properties for homepage</td></tr>
<tr><td>property.uploadPhoto</td><td>mutation</td><td>protected</td><td>Upload property photo to S3</td></tr>
<tr><td>property.getAvailability</td><td>query</td><td>public</td><td>Get property availability calendar</td></tr>
<tr><td>property.setAvailability</td><td>mutation</td><td>protected</td><td>Set availability dates and price overrides</td></tr>
<tr><td>property.getReviews</td><td>query</td><td>public</td><td>Get published reviews for a property</td></tr>
</table>

### 5.3 Booking Router (`booking`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>booking.create</td><td>mutation</td><td>protected</td><td>Create booking request</td></tr>
<tr><td>booking.updateStatus</td><td>mutation</td><td>protected</td><td>Update booking status (confirm/reject/cancel)</td></tr>
<tr><td>booking.myBookings</td><td>query</td><td>protected</td><td>List tenant's bookings</td></tr>
<tr><td>booking.landlordBookings</td><td>query</td><td>protected</td><td>List landlord's received bookings</td></tr>
<tr><td>booking.getById</td><td>query</td><td>protected</td><td>Get booking details</td></tr>
</table>

### 5.4 Payment Router (`payment`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>payment.create</td><td>mutation</td><td>protected</td><td>Create payment record</td></tr>
<tr><td>payment.myPayments</td><td>query</td><td>protected</td><td>List tenant's payments</td></tr>
<tr><td>payment.landlordPayments</td><td>query</td><td>protected</td><td>List landlord's received payments</td></tr>
<tr><td>payment.byBooking</td><td>query</td><td>protected</td><td>Get payments for a specific booking</td></tr>
<tr><td>payment.getPaymentSettings</td><td>query</td><td>public</td><td>Get payment gateway configuration</td></tr>
<tr><td>payment.createPayPalOrder</td><td>mutation</td><td>protected</td><td>Create PayPal checkout order</td></tr>
<tr><td>payment.capturePayPalOrder</td><td>mutation</td><td>protected</td><td>Capture completed PayPal payment</td></tr>
</table>

### 5.5 Messaging Router (`message`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>message.getConversations</td><td>query</td><td>protected</td><td>List user's conversations</td></tr>
<tr><td>message.getMessages</td><td>query</td><td>protected</td><td>Get messages in a conversation</td></tr>
<tr><td>message.send</td><td>mutation</td><td>protected</td><td>Send message in conversation</td></tr>
<tr><td>message.startConversation</td><td>mutation</td><td>protected</td><td>Start new conversation about a property</td></tr>
<tr><td>message.unreadCount</td><td>query</td><td>protected</td><td>Get unread message count</td></tr>
</table>

### 5.6 Admin Router (`admin`)

<table header-row="true">
<tr><td>Endpoint</td><td>Type</td><td>Auth</td><td>Description</td></tr>
<tr><td>admin.stats</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Get platform statistics (users, properties, bookings, revenue)</td></tr>
<tr><td>admin.users</td><td>query</td><td>admin(MANAGE_USERS)</td><td>List all users with filters</td></tr>
<tr><td>admin.updateUser</td><td>mutation</td><td>admin(MANAGE_USERS)</td><td>Update user role or status</td></tr>
<tr><td>admin.allBookings</td><td>query</td><td>admin(MANAGE_BOOKINGS)</td><td>List all bookings platform-wide</td></tr>
<tr><td>admin.updateBookingStatus</td><td>mutation</td><td>admin(MANAGE_BOOKINGS)</td><td>Admin override booking status</td></tr>
<tr><td>admin.allProperties</td><td>query</td><td>admin(MANAGE_PROPERTIES)</td><td>List all properties</td></tr>
<tr><td>admin.allPayments</td><td>query</td><td>admin(MANAGE_PAYMENTS)</td><td>List all payments</td></tr>
<tr><td>admin.monthlyBookings</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Monthly booking trend data for charts</td></tr>
<tr><td>admin.monthlyRevenue</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Monthly revenue trend data for charts</td></tr>
<tr><td>admin.monthlyUsers</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Monthly user registration data</td></tr>
<tr><td>admin.bookingsByStatus</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Booking distribution by status</td></tr>
<tr><td>admin.propertiesByType</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Property distribution by type</td></tr>
<tr><td>admin.propertiesByCity</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Property distribution by city</td></tr>
<tr><td>admin.serviceRequestStats</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Service request statistics</td></tr>
<tr><td>admin.emergencyStats</td><td>query</td><td>admin(VIEW_ANALYTICS)</td><td>Emergency maintenance statistics</td></tr>
</table>

### 5.7 Additional Routers Summary

<table header-row="true">
<tr><td>Router</td><td>Endpoints</td><td>Auth Level</td><td>Purpose</td></tr>
<tr><td>favorite</td><td>3</td><td>protected</td><td>Add/remove/list favorite properties</td></tr>
<tr><td>maintenance</td><td>5</td><td>protected</td><td>Standard maintenance request CRUD</td></tr>
<tr><td>notification</td><td>3</td><td>protected</td><td>In-app notification list and mark-read</td></tr>
<tr><td>review</td><td>1</td><td>protected</td><td>Submit property review (legacy)</td></tr>
<tr><td>reviews</td><td>7</td><td>mixed</td><td>Full review system with admin moderation</td></tr>
<tr><td>savedSearch</td><td>3</td><td>protected</td><td>Save/list/delete search filters</td></tr>
<tr><td>siteSettings</td><td>5</td><td>mixed</td><td>CMS settings (public read, admin write)</td></tr>
<tr><td>ai</td><td>5</td><td>protected</td><td>AI assistant conversations and messages</td></tr>
<tr><td>knowledge</td><td>5</td><td>admin</td><td>Knowledge base CRUD for AI context</td></tr>
<tr><td>lease</td><td>1</td><td>protected</td><td>Generate lease contract PDF</td></tr>
<tr><td>activity</td><td>2</td><td>admin</td><td>User activity tracking and stats</td></tr>
<tr><td>permissions</td><td>4</td><td>admin</td><td>User permission CRUD</td></tr>
<tr><td>cities</td><td>6</td><td>mixed</td><td>City management with featured toggle</td></tr>
<tr><td>districts</td><td>5</td><td>mixed</td><td>District management within cities</td></tr>
<tr><td>propertyManager</td><td>16</td><td>mixed</td><td>Property manager profiles and assignments</td></tr>
<tr><td>inspection</td><td>6</td><td>mixed</td><td>Property inspection scheduling</td></tr>
<tr><td>contact</td><td>3</td><td>mixed</td><td>Contact form submissions</td></tr>
<tr><td>services</td><td>5</td><td>mixed</td><td>Platform services CRUD</td></tr>
<tr><td>serviceRequests</td><td>4</td><td>mixed</td><td>Service request management</td></tr>
<tr><td>emergencyMaintenance</td><td>5</td><td>mixed</td><td>Emergency maintenance workflow</td></tr>
<tr><td>email</td><td>4</td><td>admin</td><td>SMTP verification and test emails</td></tr>
<tr><td>upload</td><td>1</td><td>protected</td><td>General file upload to S3</td></tr>
<tr><td>push</td><td>5</td><td>mixed</td><td>Push notification subscribe/send/broadcast</td></tr>
<tr><td>roles</td><td>6</td><td>admin</td><td>Role definition and assignment</td></tr>
<tr><td>permissionMeta</td><td>1</td><td>public</td><td>Permission category metadata for UI</td></tr>
<tr><td>aiStats</td><td>3</td><td>admin</td><td>AI assistant usage analytics</td></tr>
</table>

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

Authentication uses **Manus OAuth** with JWT session cookies. The flow is:

1. User clicks "تسجيل الدخول" (Login) on the frontend.
2. Frontend redirects to Manus OAuth portal with `window.location.origin` encoded in state.
3. User authenticates on the OAuth portal.
4. OAuth callback at `/api/oauth/callback` receives the authorization code.
5. Server exchanges code for user profile, creates/updates user record in database.
6. Server sets a signed JWT session cookie and redirects back to the frontend.
7. Subsequent requests include the cookie; `auth.me` query returns the current user.

### 6.2 User Roles

The `users` table has a `role` field with two values:

- **user** — Default role for all new registrations. Can be tenant or landlord based on actions taken.
- **admin** — Full platform administration access. Must be promoted via database or admin UI.

### 6.3 Procedure Types

```typescript
publicProcedure    // No authentication required
protectedProcedure // Requires valid session (any logged-in user)
adminProcedure     // Requires admin role
adminWithPermission(PERMISSIONS.X) // Requires admin role + specific permission
```

---

## 7. Permission System (RBAC)

The platform implements a granular **Role-Based Access Control** system with 14 permission types, protecting all 69+ admin endpoints. Permissions are cached in memory with a 5-minute TTL for performance.

### 7.1 Permission Types

<table header-row="true">
<tr><td>Permission Key</td><td>Value</td><td>Controls</td></tr>
<tr><td>MANAGE_USERS</td><td>manage_users</td><td>User list, role changes, account management</td></tr>
<tr><td>MANAGE_PROPERTIES</td><td>manage_properties</td><td>Property approval, featuring, deletion</td></tr>
<tr><td>MANAGE_BOOKINGS</td><td>manage_bookings</td><td>Booking status overrides, cancellations</td></tr>
<tr><td>MANAGE_PAYMENTS</td><td>manage_payments</td><td>Payment records, refund processing</td></tr>
<tr><td>MANAGE_SERVICES</td><td>manage_services</td><td>Platform services CRUD, service requests</td></tr>
<tr><td>MANAGE_MAINTENANCE</td><td>manage_maintenance</td><td>Emergency maintenance workflow</td></tr>
<tr><td>MANAGE_CITIES</td><td>manage_cities</td><td>City/district management, featured cities</td></tr>
<tr><td>MANAGE_CMS</td><td>manage_cms</td><td>Site settings, FAQ, hero content, legal pages</td></tr>
<tr><td>MANAGE_ROLES</td><td>manage_roles</td><td>Role definitions and user-role assignments</td></tr>
<tr><td>MANAGE_KNOWLEDGE</td><td>manage_knowledge</td><td>AI knowledge base articles</td></tr>
<tr><td>VIEW_ANALYTICS</td><td>view_analytics</td><td>Dashboard charts, statistics, reports</td></tr>
<tr><td>MANAGE_SETTINGS</td><td>manage_settings</td><td>Platform configuration, permissions</td></tr>
<tr><td>SEND_NOTIFICATIONS</td><td>send_notifications</td><td>Push notification broadcast</td></tr>
<tr><td>MANAGE_AI</td><td>manage_ai</td><td>AI assistant configuration and ratings</td></tr>
</table>

### 7.2 Permission Checking Flow

```
Request → adminProcedure (verify admin role)
       → adminWithPermission(PERMISSIONS.X)
           → Check memory cache (5-min TTL)
           → If miss: query admin_permissions table
           → If root admin: bypass all checks
           → If has permission: allow
           → If missing: throw FORBIDDEN error
```

### 7.3 Roles

Roles are named permission bundles stored in the `roles` table. Each role contains a JSON array of permission keys. The admin UI provides a visual permission matrix for role management at `/admin/permissions`.

The **Root Admin** (platform owner) bypasses all permission checks and always has full access. Root admin status is set via the `isRootAdmin` flag in the `admin_permissions` table.

---

## 8. Frontend Pages & Routes

### 8.1 Public Pages

<table header-row="true">
<tr><td>Route</td><td>Page Component</td><td>Description</td></tr>
<tr><td>/</td><td>Home.tsx</td><td>Landing page with hero, featured properties, cities, testimonials</td></tr>
<tr><td>/search</td><td>Search.tsx</td><td>Property search with filters (city, price, type, bedrooms)</td></tr>
<tr><td>/property/:id</td><td>PropertyDetail.tsx</td><td>Property details, photos, reviews, booking CTA</td></tr>
<tr><td>/agent/:id</td><td>AgentProfile.tsx</td><td>Property manager public profile</td></tr>
<tr><td>/faq</td><td>FAQ.tsx</td><td>Frequently asked questions with search and categories</td></tr>
<tr><td>/privacy</td><td>PrivacyPolicy.tsx</td><td>PDPL-compliant privacy policy (AR/EN)</td></tr>
<tr><td>/terms</td><td>TermsOfService.tsx</td><td>Terms of service (Ejar/VAT/MoT compliant)</td></tr>
<tr><td>/contact</td><td>ContactUs.tsx</td><td>Contact form with admin notification</td></tr>
<tr><td>/login</td><td>Login.tsx</td><td>Login page with OAuth redirect</td></tr>
<tr><td>/register</td><td>Register.tsx</td><td>Registration page</td></tr>
</table>

### 8.2 Tenant Pages

<table header-row="true">
<tr><td>Route</td><td>Page Component</td><td>Description</td></tr>
<tr><td>/tenant</td><td>TenantDashboard.tsx</td><td>Tenant dashboard with bookings, payments, maintenance</td></tr>
<tr><td>/book/:propertyId</td><td>BookingFlow.tsx</td><td>Multi-step booking process</td></tr>
<tr><td>/pay/:id</td><td>PaymentPage.tsx</td><td>Payment processing page</td></tr>
<tr><td>/maintenance/new/:bookingId</td><td>MaintenanceRequest.tsx</td><td>Submit maintenance request</td></tr>
<tr><td>/lease/:bookingId</td><td>LeaseContract.tsx</td><td>View/generate lease contract</td></tr>
<tr><td>/messages</td><td>Messages.tsx</td><td>Messaging inbox</td></tr>
<tr><td>/messages/:id</td><td>Messages.tsx</td><td>Conversation thread</td></tr>
</table>

### 8.3 Landlord Pages

<table header-row="true">
<tr><td>Route</td><td>Page Component</td><td>Description</td></tr>
<tr><td>/landlord</td><td>LandlordDashboard.tsx</td><td>Landlord dashboard with properties, bookings, earnings</td></tr>
<tr><td>/list-property</td><td>CreateProperty.tsx</td><td>Create new property listing</td></tr>
<tr><td>/edit-property/:id</td><td>CreateProperty.tsx</td><td>Edit existing property</td></tr>
</table>

### 8.4 Admin Pages

<table header-row="true">
<tr><td>Route</td><td>Page Component</td><td>Description</td></tr>
<tr><td>/admin</td><td>AdminDashboard.tsx</td><td>Admin overview with stats and quick actions</td></tr>
<tr><td>/admin/analytics</td><td>AdminAnalytics.tsx</td><td>8-chart analytics dashboard</td></tr>
<tr><td>/admin/settings</td><td>AdminSettings.tsx</td><td>CMS settings (hero, FAQ, legal, testimonials)</td></tr>
<tr><td>/admin/cities</td><td>CityDistrictManagement.tsx</td><td>City/district management with featured toggle</td></tr>
<tr><td>/admin/managers</td><td>AdminManagers.tsx</td><td>Property manager management</td></tr>
<tr><td>/admin/services</td><td>AdminServices.tsx</td><td>Platform services management</td></tr>
<tr><td>/admin/emergency-maintenance</td><td>AdminEmergencyMaintenance.tsx</td><td>Emergency maintenance dashboard</td></tr>
<tr><td>/admin/permissions</td><td>AdminPermissions.tsx</td><td>Roles and permissions management</td></tr>
<tr><td>/admin/knowledge-base</td><td>KnowledgeBase.tsx</td><td>AI knowledge base management</td></tr>
<tr><td>/admin/ai-ratings</td><td>AdminAIRatings.tsx</td><td>AI assistant ratings analytics</td></tr>
</table>

---

## 9. Email System

The email system uses **Nodemailer** with SMTP transport. It supports bilingual (Arabic/English) HTML email templates for all transactional emails. The system gracefully degrades when SMTP credentials are not configured — emails are logged but not sent.

### 9.1 Email Templates

<table header-row="true">
<tr><td>Template</td><td>Trigger</td><td>Recipients</td></tr>
<tr><td>Booking Confirmation</td><td>New booking created</td><td>Tenant + Landlord</td></tr>
<tr><td>Booking Status Update</td><td>Booking confirmed/rejected/cancelled</td><td>Tenant</td></tr>
<tr><td>Payment Receipt</td><td>Payment completed</td><td>Tenant</td></tr>
<tr><td>Maintenance Update</td><td>Maintenance status changed</td><td>Tenant</td></tr>
<tr><td>Welcome Email</td><td>New user registration</td><td>New user</td></tr>
</table>

### 9.2 Configuration

SMTP credentials are configured via environment variables (Settings > Secrets in the admin panel):

- `SMTP_HOST` — SMTP server hostname (e.g., smtp.gmail.com)
- `SMTP_PORT` — SMTP port (default: 587)
- `SMTP_USER` — SMTP username/email
- `SMTP_PASS` — SMTP password or app password
- `SMTP_FROM` — Sender email address displayed to recipients
- `SMTP_SECURE` — Use TLS (true for port 465, false for 587)

### 9.3 Admin Email Tools

Admins can verify SMTP configuration and send test emails from the admin panel using the `email.verifySmtp` and `email.sendTest` endpoints.

---

## 10. Push Notifications

Web Push Notifications are implemented using the **web-push** library with VAPID authentication. The service worker (`public/sw.js`) handles push event reception and notification display.

### 10.1 Flow

1. User grants notification permission in browser.
2. Frontend subscribes to push via `push.subscribe` mutation, sending the PushSubscription object.
3. Server stores subscription in `push_subscriptions` table.
4. Admin can send targeted notifications via `push.sendToUser` or broadcast via `push.broadcast`.
5. Service worker receives push event and displays native browser notification.

### 10.2 VAPID Keys

VAPID keys are pre-configured as environment variables:
- `VITE_VAPID_PUBLIC_KEY` — Public key (used by frontend)
- `VAPID_PRIVATE_KEY` — Private key (used by server)

---

## 11. PWA Support

The platform is a **Progressive Web App** with the following features:

- **Manifest** (`public/manifest.json`): App name "المفتاح الشهري", theme color, icons (192x192, 512x512), display: standalone
- **Service Worker** (`public/sw.js`): Handles push notifications and basic caching
- **Mobile Meta Tags**: viewport, theme-color, apple-mobile-web-app-capable
- **Install Prompt**: Users can install the app on mobile home screens

---

## 12. AI Assistant

The AI assistant provides contextual help to users using the platform's knowledge base. It is powered by the Manus LLM API with a system prompt that includes relevant knowledge base articles.

### 12.1 Features

- Conversational interface with message history
- Knowledge base context injection for accurate answers
- User rating system (thumbs up/down) for response quality
- Admin analytics dashboard showing rating distribution
- Bilingual support (Arabic primary, English secondary)

### 12.2 Knowledge Base

Admins manage knowledge base articles at `/admin/knowledge-base`. Each article has:
- Category (general, properties, bookings, payments, maintenance, legal)
- Bilingual title and content (Arabic/English)
- Tags for search and categorization
- Active/inactive toggle

Active articles are automatically included in the AI system prompt to provide accurate, platform-specific answers.

---

## 13. City & District Management

### 13.1 Pre-loaded Cities

The platform comes with **7 Saudi cities** pre-loaded:

<table header-row="true">
<tr><td>City (AR)</td><td>City (EN)</td><td>Region</td><td>Districts</td><td>Featured</td></tr>
<tr><td>الرياض</td><td>Riyadh</td><td>Central</td><td>10+</td><td>Yes</td></tr>
<tr><td>جدة</td><td>Jeddah</td><td>Western</td><td>10+</td><td>Yes</td></tr>
<tr><td>مكة المكرمة</td><td>Mecca</td><td>Western</td><td>10</td><td>Yes</td></tr>
<tr><td>الدمام</td><td>Dammam</td><td>Eastern</td><td>10</td><td>Yes</td></tr>
<tr><td>الخبر</td><td>Khobar</td><td>Eastern</td><td>10</td><td>No</td></tr>
<tr><td>تبوك</td><td>Tabuk</td><td>Northern</td><td>10</td><td>No</td></tr>
<tr><td>أبها</td><td>Abha</td><td>Southern</td><td>10</td><td>No</td></tr>
</table>

### 13.2 Admin Management

Cities and districts are managed from `/admin/cities`. Features include:
- Add/edit/delete cities with Arabic and English names
- Upload city images for homepage display
- Toggle "featured" status (featured cities appear on homepage)
- Add/edit/delete districts within each city
- Set GPS coordinates for map integration

---

## 14. Services & Emergency Maintenance

### 14.1 Platform Services

Admins can create bookable services (cleaning, maintenance, moving, furniture rental) from `/admin/services`. Each service has:
- Bilingual name and description
- Price in SAR
- Category (cleaning, maintenance, moving, furniture, other)
- Icon selection
- Active/inactive toggle

Tenants can request services from their dashboard, and admins manage requests with status workflow (pending → approved → in_progress → completed → cancelled).

### 14.2 Emergency Maintenance

The emergency maintenance system provides a dedicated workflow for urgent issues:

1. **Tenant submits** emergency request with urgency level (low/medium/high/critical), category, description, and photos.
2. **Admin receives** the request on the emergency dashboard (`/admin/emergency-maintenance`).
3. **Admin assigns** a technician with name and phone number.
4. **Status progresses**: open → assigned → in_progress → resolved → closed.
5. **Updates are logged** in the `maintenance_updates` table with timestamps.
6. **Tenant is notified** at each status change via in-app notifications.

---

## 15. Analytics Dashboard

The admin analytics dashboard at `/admin/analytics` provides 8 interactive charts:

1. **Monthly Bookings** — Line chart showing booking volume trends
2. **Monthly Revenue** — Area chart showing revenue in SAR
3. **User Registrations** — Bar chart showing new user signups
4. **Booking Status Distribution** — Pie chart showing pending/confirmed/active/completed/cancelled
5. **Properties by Type** — Bar chart showing apartment/villa/studio/room distribution
6. **Properties by City** — Horizontal bar chart showing city-wise property counts
7. **Service Requests** — Doughnut chart showing service request categories
8. **Emergency Maintenance** — Bar chart showing maintenance by urgency level

All charts use **Recharts** with Arabic labels and RTL-compatible layouts. Data is fetched in real-time from the database via dedicated admin query endpoints.

---

## 16. Environment Variables

### 16.1 System Variables (Pre-configured)

These are automatically injected by the platform and should not be modified manually:

<table header-row="true">
<tr><td>Variable</td><td>Purpose</td></tr>
<tr><td>DATABASE_URL</td><td>MySQL/TiDB connection string</td></tr>
<tr><td>JWT_SECRET</td><td>Session cookie signing secret</td></tr>
<tr><td>VITE_APP_ID</td><td>Manus OAuth application ID</td></tr>
<tr><td>OAUTH_SERVER_URL</td><td>Manus OAuth backend base URL</td></tr>
<tr><td>VITE_OAUTH_PORTAL_URL</td><td>Manus login portal URL</td></tr>
<tr><td>OWNER_OPEN_ID</td><td>Platform owner's user ID</td></tr>
<tr><td>OWNER_NAME</td><td>Platform owner's display name</td></tr>
<tr><td>BUILT_IN_FORGE_API_URL</td><td>Manus built-in API endpoint</td></tr>
<tr><td>BUILT_IN_FORGE_API_KEY</td><td>Server-side API key for Manus services</td></tr>
<tr><td>VITE_FRONTEND_FORGE_API_KEY</td><td>Frontend API key for Manus services</td></tr>
<tr><td>VITE_FRONTEND_FORGE_API_URL</td><td>Frontend API URL for Manus services</td></tr>
<tr><td>VITE_VAPID_PUBLIC_KEY</td><td>VAPID public key for push notifications</td></tr>
<tr><td>VAPID_PRIVATE_KEY</td><td>VAPID private key for push notifications</td></tr>
</table>

### 16.2 User-Configurable Variables

These should be added via Settings > Secrets in the admin panel:

<table header-row="true">
<tr><td>Variable</td><td>Required</td><td>Purpose</td><td>Example</td></tr>
<tr><td>SMTP_HOST</td><td>For email</td><td>SMTP server hostname</td><td>smtp.gmail.com</td></tr>
<tr><td>SMTP_PORT</td><td>For email</td><td>SMTP port number</td><td>587</td></tr>
<tr><td>SMTP_USER</td><td>For email</td><td>SMTP username</td><td>noreply@monthlykey.com</td></tr>
<tr><td>SMTP_PASS</td><td>For email</td><td>SMTP password/app password</td><td>xxxx-xxxx-xxxx</td></tr>
<tr><td>SMTP_FROM</td><td>For email</td><td>Sender display address</td><td>المفتاح الشهري noreply@monthlykey.com</td></tr>
<tr><td>SMTP_SECURE</td><td>For email</td><td>Use TLS (true/false)</td><td>false</td></tr>
<tr><td>VITE_GA_MEASUREMENT_ID</td><td>For analytics</td><td>Google Analytics 4 measurement ID</td><td>G-XXXXXXXXXX</td></tr>
</table>

---

## 17. Deployment Guide

### 17.1 Manus Hosting (Recommended)

The platform is designed for deployment on Manus hosting infrastructure:

1. Ensure all tests pass: `pnpm test`
2. Save a checkpoint via the Manus UI or `webdev_save_checkpoint`
3. Click the **Publish** button in the Manus Management UI header
4. The platform will be deployed to `{project-name}.manus.space`
5. Custom domains can be configured in Settings > Domains

### 17.2 Database Migrations

When making schema changes:

```bash
# Edit drizzle/schema.ts with your changes
# Then push to database:
pnpm db:push
```

This command runs `drizzle-kit generate` and `drizzle-kit migrate` to apply schema changes.

### 17.3 Post-Deployment Checklist

1. Verify the site loads at the deployment URL
2. Log in as admin and verify dashboard access
3. Configure SMTP credentials in Settings > Secrets
4. Add Google Analytics measurement ID if needed
5. Seed initial data (cities, knowledge base) if not already done
6. Set the platform owner as root admin in the database
7. Configure CMS settings (hero content, FAQ, testimonials, legal info)

---

## 18. Testing

The platform has **302 tests** across **17 test files**, all passing. Tests use **Vitest** with mocked database and authentication contexts.

### 18.1 Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
npx vitest run server/admin.test.ts

# Run with verbose output
npx vitest run --reporter=verbose
```

### 18.2 Test Coverage by Feature

<table header-row="true">
<tr><td>Test File</td><td>Tests</td><td>Coverage</td></tr>
<tr><td>server/auth.logout.test.ts</td><td>Reference</td><td>Auth logout flow</td></tr>
<tr><td>server/property.test.ts</td><td>20+</td><td>Property CRUD, search, availability</td></tr>
<tr><td>server/booking.test.ts</td><td>15+</td><td>Booking creation, status workflow</td></tr>
<tr><td>server/payment.test.ts</td><td>15+</td><td>Payment processing, PayPal integration</td></tr>
<tr><td>server/message.test.ts</td><td>10+</td><td>Messaging, conversations</td></tr>
<tr><td>server/admin.test.ts</td><td>30+</td><td>Admin endpoints, analytics queries</td></tr>
<tr><td>server/maintenance.test.ts</td><td>10+</td><td>Maintenance requests</td></tr>
<tr><td>server/review.test.ts</td><td>15+</td><td>Reviews, ratings, moderation</td></tr>
<tr><td>server/email.test.ts</td><td>15</td><td>SMTP configuration, email sending</td></tr>
<tr><td>server/push.test.ts</td><td>10+</td><td>Push subscription, broadcast</td></tr>
<tr><td>server/permissions.test.ts</td><td>20+</td><td>RBAC permission checks, caching</td></tr>
<tr><td>server/cities.test.ts</td><td>15+</td><td>City/district CRUD, featured toggle</td></tr>
<tr><td>server/services.test.ts</td><td>15+</td><td>Services, service requests</td></tr>
<tr><td>server/emergency.test.ts</td><td>15+</td><td>Emergency maintenance workflow</td></tr>
<tr><td>server/roles.test.ts</td><td>15+</td><td>Role CRUD, assignment</td></tr>
<tr><td>server/ai.test.ts</td><td>15+</td><td>AI conversations, knowledge base</td></tr>
<tr><td>server/activity.test.ts</td><td>10+</td><td>Activity tracking, stats</td></tr>
</table>

### 18.3 Test Patterns

All tests follow a consistent pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("./db", () => ({ ... }));

// Mock auth context
const mockCtx = {
  user: { id: 1, role: "admin", openId: "test-open-id" },
  db: mockDb,
};

describe("Feature", () => {
  it("should do something", async () => {
    const result = await caller.router.endpoint(input);
    expect(result).toBeDefined();
  });
});
```

---

## 19. Future Enhancements

The following features are recommended for future development phases:

### 19.1 High Priority

- **ZATCA E-Invoicing Compliance**: Generate QR codes on invoices per Saudi tax authority requirements. Requires implementing the ZATCA TLV format and Base64 encoding.
- **Payment Gateway Integration**: Connect Stripe or Moyasar for real payment processing. The payment schema already supports both Stripe and PayPal fields.
- **Owner Dashboard**: Dedicated financial reporting dashboard for property owners with revenue breakdowns, occupancy rates, and tax summaries.

### 19.2 Medium Priority

- **Real-time Messaging**: Replace polling with WebSocket connections for instant message delivery.
- **Advanced Search**: Add map-based property search with Google Maps integration (component already exists).
- **Automated Lease Generation**: Generate Ejar-compliant lease contracts as downloadable PDFs.
- **Multi-language Support**: Extend beyond Arabic/English to support additional languages.

### 19.3 Low Priority

- **Mobile App**: Build native iOS/Android apps using React Native, sharing the tRPC API layer.
- **Property Comparison**: Allow tenants to compare multiple properties side-by-side.
- **Landlord Verification**: KYC workflow for landlord identity verification with document upload.
- **Revenue Analytics**: Advanced financial analytics with charts, projections, and export capabilities.

---

## Appendix A: CMS Settings Keys

All CMS settings are stored in the `platform_settings` table and editable from `/admin/settings`. Key settings include:

<table header-row="true">
<tr><td>Setting Key</td><td>Purpose</td><td>Default</td></tr>
<tr><td>site_name</td><td>Platform name displayed in header/footer</td><td>المفتاح الشهري</td></tr>
<tr><td>hero_title</td><td>Homepage hero section title</td><td>المفتاح الشهري</td></tr>
<tr><td>hero_subtitle</td><td>Homepage hero section subtitle</td><td>Arabic subtitle text</td></tr>
<tr><td>hero_image</td><td>Homepage hero background image URL</td><td>Default image</td></tr>
<tr><td>hero_video</td><td>Homepage hero background video URL</td><td>Empty</td></tr>
<tr><td>faq_items</td><td>FAQ page content (JSON array)</td><td>Pre-loaded FAQ</td></tr>
<tr><td>testimonials</td><td>Homepage testimonials (JSON array)</td><td>Pre-loaded testimonials</td></tr>
<tr><td>tourism_licence</td><td>Tourism licence number for footer</td><td>Placeholder</td></tr>
<tr><td>cr_number</td><td>Commercial registration number</td><td>Empty</td></tr>
<tr><td>vat_number</td><td>VAT registration number</td><td>Empty</td></tr>
<tr><td>ejar_licence</td><td>Ejar licence number</td><td>Empty</td></tr>
</table>

---

## Appendix B: Quick Reference Commands

```bash
# Start development server
pnpm run dev

# Run all tests
pnpm test

# Push database schema changes
pnpm db:push

# Build for production
pnpm build

# Type check
npx tsc --noEmit
```

---

*This documentation was generated for المفتاح الشهري v1.0.0. For questions or updates, refer to the GitHub repositories: [alramady/re](https://github.com/alramady/re) and [alramady/Monthly-Key](https://github.com/alramady/Monthly-Key).*
