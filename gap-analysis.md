# Gap Analysis: Current Implementation vs Revised Safety Report

## Critical Gaps to Fix

### 1. Occupancy — MUST NOT fallback to LOCAL for Beds24 units
- **Current**: occupancy.ts falls back to LOCAL when Beds24 data unavailable
- **Required**: Return UNKNOWN instead of LOCAL fallback
- **Files**: server/occupancy.ts

### 2. Beds24 Map — Missing UNIQUE constraints
- **Current**: beds24_map has no UNIQUE on unit_id or beds24_room_id
- **Required**: UNIQUE(unit_id), UNIQUE(beds24_room_id)
- **Files**: drizzle/schema.ts, drizzle/0017_finance_registry.sql

### 3. Unit Status Enum — Missing values
- **Current**: OCCUPIED, AVAILABLE, MAINTENANCE
- **Required**: AVAILABLE, BLOCKED, MAINTENANCE (no OCCUPIED — occupancy is derived)
- **Files**: drizzle/schema.ts, drizzle/0017_finance_registry.sql

### 4. Ledger Immutability — Not enforced in code
- **Current**: updateStatus can change any status
- **Required**: PAID rows cannot have amount edited; corrections via ADJUSTMENT/REFUND rows
- **Files**: server/finance-registry.ts, server/finance-routers.ts

### 5. KPIs — Missing PAR, Collected YTD, EAR, Unknown count
- **Current**: occupancyRate, collectedMTD, outstandingBalance, ADR, RevPAU
- **Required**: Add PAR, Collected YTD, EAR, Unknown units count
- **Files**: server/finance-registry.ts

### 6. Renewals — Missing beds24_change_note requirement
- **Current**: approveExtension doesn't require beds24_change_note
- **Required**: beds24_change_note REQUIRED when requires_beds24_update=true
- **Files**: server/renewal.ts

### 7. Webhook-only finalization
- **Current**: updateStatus allows direct PAID transition
- **Required**: Only webhooks can set status to PAID
- **Files**: server/finance-registry.ts, server/finance-routers.ts

### 8. Human-friendly IDs
- **Current**: Auto-increment integers
- **Required**: BLD-00027, UNT-01234 format
- **Files**: drizzle/schema.ts, server/finance-registry.ts

### 9. Admin UI — Missing UNKNOWN status display
- **Current**: Shows Occupied/Available/Maintenance
- **Required**: Add Unknown status for Beds24 units without data
- **Files**: client/src/pages/AdminBuildings.tsx, AdminUnitFinance.tsx
