# Codebase Audit Notes

## Database
- MySQL via Drizzle ORM
- Schema: drizzle/schema.ts (629 lines, 30+ tables)
- Migrations: drizzle/0000-0016 (journal-based, run via start.sh)
- DB functions: server/db.ts (1907 lines)

## Existing Tables Relevant
- properties: has landlordId, city, district, bedrooms, monthlyRent, etc.
- bookings: propertyId, tenantId, landlordId, status, moveInDate, moveOutDate, durationMonths, monthlyRent
- payments: bookingId, tenantId, landlordId, type(rent/deposit/service_fee/refund), amount, status, paypal fields
- platformSettings: key-value store for settings

## NO Beds24 Integration in Main Server
- Beds24 SDK exists in packages/beds24-sdk/ (separate package)
- No Beds24 references in server/*.ts files
- Beds24 is used in apps/cobnb-web/ (separate app)
- Safe to add beds24_map table without conflicts

## Admin System
- Permissions: server/permissions.ts (14 permissions including MANAGE_PAYMENTS, MANAGE_BOOKINGS)
- Admin routes: server/routers.ts line 788+ (admin: router({...}))
- Admin pages: 14 existing pages in client/src/pages/
- Routes: client/src/App.tsx (admin/* routes)

## What Needs to Be Created (NEW, additive only)
### Schema (drizzle/schema.ts additions)
- buildings table
- units table  
- beds24_map table
- payment_ledger table
- booking_extensions table (for renewals)
- unit_daily_status table (occupancy snapshots)
- payment_settings table (or use platformSettings)

### Migration
- drizzle/0017_finance_registry.sql

### Server (new files, don't modify existing)
- server/finance-registry.ts (ledger CRUD, KPI calculations)
- server/occupancy.ts (occupancy computation)
- server/renewal.ts (renewal logic)
- Add routes to server/routers.ts (additive, in admin section)

### Client (new pages)
- AdminPaymentsRegistry.tsx
- AdminBuildingOverview.tsx
- AdminUnitFinance.tsx
- Routes in App.tsx
