# Monthly Key — Software Requirements Specification (SRS)

**Document Version:** 1.0
**Date:** February 25, 2026
**Author:** the platform — Enterprise Documentation Engine
**Classification:** Internal — For Development Teams

---

## Table of Contents

1. [Product Scope](#1-product-scope)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [API & Integration Specification](#4-api--integration-specification)
5. [Data Model Documentation](#5-data-model-documentation)
6. [Future Roadmap (Phased)](#6-future-roadmap-phased)

---

## 1. Product Scope

### 1.1 What Monthly Key Is

**Monthly Key** is a monthly rental marketplace platform serving the Saudi Arabian market. It connects tenants seeking monthly rental accommodations with landlords and property managers who offer furnished and unfurnished properties for short-to-medium term stays (1–12 months). The platform provides end-to-end rental lifecycle management including property discovery, booking, payment processing, lease management, maintenance requests, and in-app messaging.

The platform operates as a multi-channel system with three consumer-facing brands:

- **Monthly Key** (`monthlykey.com`) — The primary consumer brand for the Saudi market
- **CoBnB** — A secondary channel brand with its own frontend
- **Ops Dashboard** — An internal operations management interface

All three channels share a common backend infrastructure through the **Hub API**, which orchestrates bookings, properties, and user data across channels while integrating with **Beds24** as the external property management system (PMS).

### 1.2 User Roles and Permissions Matrix

The system defines four primary user roles with distinct permission sets:

| Capability | Tenant | Landlord | Admin | Support (Future) |
|-----------|--------|----------|-------|-------------------|
| Browse & search properties | ✅ | ✅ | ✅ | ✅ |
| View property details | ✅ | ✅ | ✅ | ✅ |
| Create bookings | ✅ | ❌ | ✅ | ❌ |
| Manage own bookings | ✅ | ❌ | ✅ | Read-only |
| List properties | ❌ | ✅ | ✅ | ❌ |
| Edit own properties | ❌ | ✅ | ✅ | ❌ |
| View booking requests | ❌ | ✅ (own) | ✅ (all) | ✅ (assigned) |
| Approve/reject bookings | ❌ | ✅ | ✅ | ❌ |
| Submit maintenance requests | ✅ | ❌ | ✅ | ✅ |
| Manage maintenance requests | ❌ | ✅ (own) | ✅ (all) | ✅ (assigned) |
| Send/receive messages | ✅ | ✅ | ✅ | ✅ |
| Leave reviews | ✅ | ❌ | ✅ | ❌ |
| Save favorites | ✅ | ❌ | ✅ | ❌ |
| Access admin dashboard | ❌ | ❌ | ✅ | ❌ |
| Manage users | ❌ | ❌ | ✅ | ❌ |
| Manage platform settings | ❌ | ❌ | ✅ | ❌ |
| View analytics | ❌ | ✅ (own) | ✅ (all) | ❌ |
| Manage property managers | ❌ | ❌ | ✅ | ❌ |
| AI assistant access | ✅ | ✅ | ✅ | ✅ |
| Generate lease contracts | ❌ | ✅ | ✅ | ❌ |
| Emergency maintenance | ✅ | ✅ | ✅ | ✅ |

### 1.3 Core User Journeys

**Journey 1: Tenant — Browse to Booking**

1. **Landing** → Tenant arrives at the homepage, sees hero section with search bar, featured properties, and city highlights.
2. **Search** → Tenant enters location, dates, and guest count. Results appear on a split map/list view with filters (price range, property type, amenities, district).
3. **Property Details** → Tenant clicks a listing to see full photo gallery, description (AR/EN), amenities, location on map, reviews, and availability calendar.
4. **Booking** → Tenant selects dates, reviews pricing breakdown (rent + service fee + VAT), and proceeds to booking.
5. **Payment** → Tenant completes payment via PayPal (current) or future payment methods.
6. **Dashboard** → Tenant sees booking confirmation, can access lease contract, message landlord, and submit maintenance requests.

**Journey 2: Landlord — Property Management**

1. **Registration** → Landlord creates an account and is verified by admin.
2. **Property Listing** → Landlord creates a property with details, photos, pricing, and availability.
3. **Booking Management** → Landlord receives booking requests, reviews tenant profiles, and approves/rejects.
4. **Maintenance** → Landlord receives maintenance requests from tenants, assigns tasks, and tracks resolution.
5. **Analytics** → Landlord views occupancy rates, revenue, and booking trends.

**Journey 3: Admin — Platform Operations**

1. **Dashboard** → Admin sees platform-wide KPIs: total bookings, revenue, active properties, user counts.
2. **User Management** → Admin manages user accounts, roles, and permissions.
3. **Property Oversight** → Admin reviews all properties, can feature/unfeature, and manage content.
4. **Settings** → Admin configures platform settings (hero content, SEO, WhatsApp, email templates).
5. **AI Control** → Admin manages the AI assistant's knowledge base and conversation history.
6. **Emergency** → Admin handles emergency maintenance escalations.

---

## 2. Functional Requirements

### 2.1 Search & Filters Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-S01 | Location-based search with autocomplete | User types 3+ characters → autocomplete suggestions appear within 300ms. Results are filtered by selected location. | P0 |
| FR-S02 | Date range selection | User selects check-in and check-out dates. Minimum stay: 1 month. Properties with conflicting bookings are excluded. | P0 |
| FR-S03 | Guest count filter | User specifies number of guests. Properties with insufficient capacity are excluded. | P0 |
| FR-S04 | Price range filter | Slider or input fields for min/max monthly price (SAR). Results update in real-time. | P1 |
| FR-S05 | Property type filter | Checkboxes for: Apartment, Villa, Studio, Room. Multiple selections allowed. | P1 |
| FR-S06 | Amenities filter | Checkboxes for common amenities (WiFi, parking, pool, gym, etc.). AND logic — all selected must be present. | P1 |
| FR-S07 | Map view with clustering | Search results displayed on an interactive map with marker clustering. Clicking a marker shows a preview card. | P0 |
| FR-S08 | List view with pagination | Search results in a card grid with lazy loading or pagination (20 per page). | P0 |
| FR-S09 | Sort options | Sort by: Price (low/high), Rating, Newest, Distance. | P1 |
| FR-S10 | Saved searches | Authenticated users can save search criteria and receive notifications when new matching properties are listed. | P2 |
| FR-S11 | City/district browsing | Users can browse properties by city and district from the homepage. | P1 |

### 2.2 Property Details & Gallery Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-P01 | Photo gallery with lightbox | Full-screen photo gallery with swipe navigation. Minimum 3 photos per property. | P0 |
| FR-P02 | Bilingual description | Property description in Arabic and English, auto-switching based on user locale. | P0 |
| FR-P03 | Amenities list | Visual amenities display with icons and labels. | P0 |
| FR-P04 | Location map | Interactive map showing property location with nearby landmarks. | P0 |
| FR-P05 | Availability calendar | Monthly calendar showing available/booked dates. Synced with Beds24 when connected. | P0 |
| FR-P06 | Pricing breakdown | Clear display of monthly rent, service fee, VAT, and total. | P0 |
| FR-P07 | Reviews section | Display tenant reviews with ratings (1-5 stars), date, and reviewer name. | P1 |
| FR-P08 | Share property | Share via WhatsApp, copy link, or social media. | P2 |
| FR-P09 | Report property | Users can report inappropriate listings. | P2 |
| FR-P10 | Similar properties | Recommendation section showing similar properties in the same area/price range. | P2 |

### 2.3 Booking Flow Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-B01 | Date selection with validation | User selects check-in date (future only) and duration (1–12 months). System validates availability. | P0 |
| FR-B02 | Pricing calculation | System calculates total: (monthly rent × months) + service fee + VAT. Displayed before confirmation. | P0 |
| FR-B03 | Booking creation | System creates a booking record with status `pending`. Landlord is notified. | P0 |
| FR-B04 | Payment processing | User is redirected to PayPal for payment. On success, booking status changes to `confirmed`. | P0 |
| FR-B05 | Booking confirmation | User receives confirmation with booking details, property address, and landlord contact. | P0 |
| FR-B06 | Booking cancellation | Tenant can cancel within cancellation policy window. Refund processed according to policy. | P1 |
| FR-B07 | Lease contract generation | System generates a lease contract PDF with booking details, signed digitally by both parties. | P1 |
| FR-B08 | Configurable rental duration | Admin can configure minimum and maximum rental durations from the backend. Default: 1–2 months (expandable). | P1 |

### 2.4 Tenant Dashboard Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-T01 | Active bookings overview | Display current active bookings with property details, dates, and status. | P0 |
| FR-T02 | Booking history | List of past bookings with ability to leave reviews. | P1 |
| FR-T03 | Favorites list | Saved properties with quick access to details. | P1 |
| FR-T04 | Maintenance request submission | Form to submit maintenance requests with description, photos, and priority level. | P0 |
| FR-T05 | Maintenance tracking | View status of submitted maintenance requests with updates timeline. | P1 |
| FR-T06 | Messages inbox | View and respond to conversations with landlords. | P0 |
| FR-T07 | Profile management | Edit personal information, change password, notification preferences. | P1 |
| FR-T08 | Payment history | View all payment transactions with receipts. | P1 |

### 2.5 Landlord Dashboard Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-L01 | Property management | List, edit, and deactivate owned properties. | P0 |
| FR-L02 | Booking requests | View incoming booking requests with tenant details. Approve or reject. | P0 |
| FR-L03 | Active bookings | View all active bookings across properties. | P0 |
| FR-L04 | Maintenance management | View and manage maintenance requests for owned properties. | P0 |
| FR-L05 | Revenue analytics | Charts showing monthly revenue, occupancy rates, and booking trends. | P1 |
| FR-L06 | Calendar view | Unified calendar showing bookings across all properties. | P1 |
| FR-L07 | Tenant communication | Message tenants directly from the dashboard. | P0 |
| FR-L08 | Property creation wizard | Step-by-step wizard for creating new property listings with validation. | P0 |

### 2.6 Admin Capabilities Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-A01 | Platform dashboard | KPI cards: total users, properties, bookings, revenue. Trend charts. | P0 |
| FR-A02 | User management | CRUD operations on user accounts. Role assignment. Account suspension. | P0 |
| FR-A03 | Property moderation | Review, approve, feature, or remove property listings. | P0 |
| FR-A04 | Platform settings | Configure site name, description, hero content, contact info, WhatsApp number. | P0 |
| FR-A05 | City/district management | Add, edit, and organize cities and districts for location filtering. | P1 |
| FR-A06 | AI assistant management | Configure AI knowledge base, view conversation logs, manage AI ratings. | P1 |
| FR-A07 | Permission management | Granular permission assignment per admin user. | P1 |
| FR-A08 | Property manager management | Assign property managers to properties. Track manager performance. | P1 |
| FR-A09 | Analytics dashboard | Detailed analytics with filters by date range, city, property type. | P1 |
| FR-A10 | Emergency maintenance | Handle escalated maintenance requests with priority routing. | P1 |
| FR-A11 | Platform services | Manage additional platform services offered to landlords. | P2 |
| FR-A12 | Contact message management | View and respond to contact form submissions. | P2 |

### 2.7 Maintenance Tickets Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-M01 | Ticket creation | Tenant submits ticket with: title, description, category, priority, photos. | P0 |
| FR-M02 | Photo attachments | Up to 5 photos per ticket. Accepted formats: JPEG, PNG, WebP. Max 10MB each. | P0 |
| FR-M03 | Status tracking | Ticket statuses: `open` → `in_progress` → `resolved` → `closed`. | P0 |
| FR-M04 | Update timeline | Chronological list of updates with timestamps and author. | P1 |
| FR-M05 | Emergency escalation | Tenants can mark tickets as emergency. Admin is immediately notified. | P1 |
| FR-M06 | Assignment | Admin/landlord can assign tickets to property managers or maintenance staff. | P1 |

### 2.8 Messaging Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-MSG01 | Conversation creation | System auto-creates a conversation when a booking is confirmed. | P0 |
| FR-MSG02 | Real-time messaging | Messages appear without page refresh. Typing indicators (future). | P0 |
| FR-MSG03 | Message notifications | Push notification and in-app badge for new messages. | P1 |
| FR-MSG04 | Message history | Full conversation history with timestamps. | P0 |
| FR-MSG05 | File sharing | Share images and documents within conversations. | P2 |

### 2.9 Favorites & Sharing Module

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|-------------------|----------|
| FR-F01 | Add/remove favorites | Heart icon on property cards and detail page. Toggle on click. | P1 |
| FR-F02 | Favorites list | Dedicated page showing all saved properties with quick actions. | P1 |
| FR-F03 | Share via WhatsApp | One-tap sharing with pre-formatted message and property link. | P1 |
| FR-F04 | Copy link | Copy property URL to clipboard with confirmation toast. | P2 |

---

## 3. Non-Functional Requirements

### 3.1 Security Standards

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SEC01 | Authentication | JWT-based with refresh tokens. Access token: 15 min. Refresh token: 30 days. |
| NFR-SEC02 | Password policy | Minimum 12 characters, mixed case, numbers, special characters. |
| NFR-SEC03 | Data encryption | TLS 1.3 in transit. AES-256 at rest for PII. |
| NFR-SEC04 | Input validation | Server-side validation on all endpoints using Zod schemas. |
| NFR-SEC05 | Rate limiting | Redis-backed. Auth endpoints: 5 req/min. API: 100 req/min per user. |
| NFR-SEC06 | CSP | Strict Content Security Policy without `unsafe-inline` or `unsafe-eval`. |
| NFR-SEC07 | OWASP Top 10 | All OWASP Top 10 risks must be mitigated. |
| NFR-SEC08 | Dependency scanning | Automated vulnerability scanning on every PR. |

### 3.2 Availability Targets

| Metric | Target |
|--------|--------|
| Uptime | 99.9% (8.76 hours downtime/year) |
| Planned maintenance window | Sundays 02:00–04:00 AST |
| Recovery Time Objective (RTO) | < 15 minutes |
| Recovery Point Objective (RPO) | < 1 hour |

### 3.3 Performance Targets (Core Web Vitals)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Largest Contentful Paint (LCP) | < 2.5s | 75th percentile |
| First Input Delay (FID) | < 100ms | 75th percentile |
| Cumulative Layout Shift (CLS) | < 0.1 | 75th percentile |
| Time to First Byte (TTFB) | < 600ms | 75th percentile |
| API response time (p95) | < 500ms | Server-side |
| Search results load time | < 1.5s | Client-side |
| Map rendering time | < 2s | Client-side |

### 3.4 Data Privacy

The platform must comply with Saudi Arabia's **Personal Data Protection Law (PDPL)**, which came into effect in September 2023. Key requirements include:

- **Consent:** Explicit user consent before collecting personal data. Privacy policy must be displayed during registration.
- **Data minimization:** Collect only data necessary for the stated purpose.
- **Right to access:** Users can request a copy of their personal data.
- **Right to deletion:** Users can request deletion of their account and associated data.
- **Data breach notification:** Notify the Saudi Data & AI Authority (SDAIA) within 72 hours of a data breach.
- **Cross-border transfer:** Personal data must be stored within Saudi Arabia or in jurisdictions with adequate protection.

### 3.5 Audit Logs (Future)

All administrative actions and data modifications should be logged with:

- Timestamp (ISO 8601, AST timezone)
- User ID and role
- Action type (CREATE, READ, UPDATE, DELETE)
- Resource type and ID
- IP address
- Previous and new values (for updates)

The `userActivities` table exists in the schema but should be expanded to cover all admin operations.

### 3.6 Localization & RTL Requirements

| Requirement | Details |
|-------------|---------|
| Languages | Arabic (primary), English (secondary) |
| Direction | RTL for Arabic, LTR for English. Dynamic switching. |
| Date format | Hijri calendar support (future). Gregorian default. |
| Currency | SAR (Saudi Riyal) with proper formatting (٫ for decimal in Arabic). |
| Phone format | +966 prefix with Saudi number validation. |
| Address format | Saudi address format with district/city hierarchy. |
| Content | All UI text, error messages, and email templates must be bilingual. |
| CSS | Use logical properties (`margin-inline-start` instead of `margin-left`). |

### 3.7 Mobile-First Constraints

| Constraint | Details |
|-----------|---------|
| Breakpoints | Mobile: 0–640px, Tablet: 641–1024px, Desktop: 1025px+ |
| Touch targets | Minimum 44×44px for all interactive elements |
| Safe areas | Support `env(safe-area-inset-*)` for notched devices |
| Offline | Graceful degradation with cached data (future PWA) |
| Performance | JavaScript bundle < 300KB gzipped for initial load |
| Images | Responsive images with `srcset`. WebP format preferred. |

---

## 4. API & Integration Specification

### 4.1 Beds24 Integration Boundaries

The Beds24 PMS integration is managed through the `@mk/beds24-sdk` package. The following table defines what data comes from Beds24 versus the local database:

| Data | Source of Truth | Sync Direction | Notes |
|------|----------------|----------------|-------|
| Property details (name, description, photos) | **Beds24** | Beds24 → Local DB | Synced periodically and on webhook events |
| Room types and configurations | **Beds24** | Beds24 → Local DB | |
| Availability calendar | **Beds24** | Beds24 → Local DB | Real-time check via API before booking |
| Pricing (nightly/monthly rates) | **Beds24** | Beds24 → Local DB | |
| Bookings | **Both** | Bidirectional | Created locally, pushed to Beds24. Beds24 changes synced back. |
| Guest information | **Local DB** | Local → Beds24 | Tenant data stored locally, synced to Beds24 on booking |
| User accounts (tenants, landlords) | **Local DB** | N/A | Not in Beds24 |
| Reviews | **Local DB** | N/A | Not in Beds24 |
| Maintenance requests | **Local DB** | N/A | Not in Beds24 |
| Messages | **Local DB** | N/A | Not in Beds24 |
| Platform settings | **Local DB** | N/A | Not in Beds24 |
| Analytics | **Local DB** | N/A | Not in Beds24 |

**Beds24 SDK Endpoints Used:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/authentication/token` | GET | Refresh access token using refresh token |
| `/v2/properties` | GET | Fetch all properties |
| `/v2/rooms` | GET | Fetch rooms for properties |
| `/v2/inventory` | GET | Fetch availability and pricing |
| `/v2/bookings` | GET/POST/PUT | Manage bookings |
| `/v2/guests` | GET/POST | Manage guest records |

**Webhook Events (when enabled):**

| Event | Action |
|-------|--------|
| `booking.new` | Create/update local booking record |
| `booking.modified` | Update local booking record |
| `booking.cancelled` | Update booking status to cancelled |
| `property.updated` | Re-sync property details |

### 4.2 Map Integration Approach

The current implementation uses **Leaflet** (open-source) for map rendering with **OpenStreetMap** tiles. The `client/src/components/Map.tsx` component also supports Google Maps via a proxy authentication system.

**Hybrid Strategy for Future:**

| Phase | Map Provider | Use Case |
|-------|-------------|----------|
| Current | Leaflet + OSM | Property location display, search results map |
| Phase 2 | Google Maps (via proxy) | Places autocomplete, geocoding, directions |
| Phase 3 | Custom tile server | High-traffic optimization (1M+ loads/month) |

The Google Maps proxy is already implemented and handles authentication transparently. No API key is needed from the user.

### 4.3 Analytics Events Standard (GA4 Naming Conventions)

All analytics events should follow Google Analytics 4 naming conventions:

| Event Name | Parameters | Trigger |
|-----------|-----------|---------|
| `page_view` | `page_title`, `page_location` | Every page navigation |
| `search` | `search_term`, `city`, `district` | Search execution |
| `view_item` | `item_id`, `item_name`, `price` | Property detail view |
| `add_to_wishlist` | `item_id`, `item_name` | Add to favorites |
| `begin_checkout` | `item_id`, `value`, `currency` | Start booking flow |
| `purchase` | `transaction_id`, `value`, `currency` | Booking confirmed |
| `sign_up` | `method` | User registration |
| `login` | `method` | User login |
| `share` | `method`, `content_type`, `item_id` | Property shared |
| `submit_maintenance` | `ticket_id`, `priority` | Maintenance request submitted |
| `send_message` | `conversation_id` | Message sent |

---

## 5. Data Model Documentation

### 5.1 Entities Overview

The following entity-relationship summary describes the core data model. The main application uses **MySQL** with 30 tables, while the Hub API uses **PostgreSQL** with 14 tables.

#### Main Application (MySQL — `drizzle/schema.ts`)

**Users Entity:**

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique user identifier |
| `name` | VARCHAR(255) | NOT NULL | Full name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| `phone` | VARCHAR(20) | | Phone number (+966 format) |
| `password` | VARCHAR(255) | NOT NULL | bcrypt hashed password |
| `role` | ENUM | NOT NULL, DEFAULT 'tenant' | `tenant`, `landlord`, `admin` |
| `avatar` | TEXT | | Profile photo URL |
| `nationalId` | VARCHAR(20) | | Saudi national ID |
| `isVerified` | BOOLEAN | DEFAULT false | Email/phone verification status |
| `isActive` | BOOLEAN | DEFAULT true | Account active status |
| `preferredLanguage` | VARCHAR(5) | DEFAULT 'ar' | `ar` or `en` |
| `createdAt` | TIMESTAMP | DEFAULT NOW | Account creation date |

**Properties Entity:**

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique property identifier |
| `landlordId` | INT | NOT NULL | Owner user ID |
| `titleAr` / `titleEn` | VARCHAR(255) | NOT NULL | Bilingual title |
| `descriptionAr` / `descriptionEn` | TEXT | | Bilingual description |
| `type` | ENUM | NOT NULL | `apartment`, `villa`, `studio`, `room` |
| `monthlyPrice` | DECIMAL(10,2) | NOT NULL | Monthly rent in SAR |
| `cityId` / `districtId` | INT | | Location references |
| `address` | TEXT | | Full address |
| `latitude` / `longitude` | DECIMAL(10,8) | | Map coordinates |
| `bedrooms` / `bathrooms` | INT | | Room counts |
| `area` | DECIMAL(10,2) | | Area in square meters |
| `amenities` | JSON | | Array of amenity strings |
| `images` | JSON | | Array of image URLs |
| `isFeatured` | BOOLEAN | DEFAULT false | Admin-featured flag |
| `isActive` | BOOLEAN | DEFAULT true | Listing active status |
| `beds24PropertyId` | VARCHAR(50) | | External Beds24 ID |

**Bookings Entity:**

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique booking identifier |
| `propertyId` | INT | NOT NULL | Property reference |
| `tenantId` | INT | NOT NULL | Tenant user reference |
| `landlordId` | INT | NOT NULL | Landlord user reference |
| `checkIn` / `checkOut` | DATE | NOT NULL | Booking dates |
| `monthlyPrice` | DECIMAL(10,2) | NOT NULL | Agreed monthly price |
| `totalPrice` | DECIMAL(10,2) | NOT NULL | Total booking cost |
| `serviceFee` | DECIMAL(10,2) | | Platform service fee |
| `status` | ENUM | NOT NULL | `pending`, `confirmed`, `active`, `completed`, `cancelled` |
| `beds24BookingId` | VARCHAR(50) | | External Beds24 booking ID |
| `cancellationReason` | TEXT | | If cancelled |

### 5.2 Field-Level Validation Rules

| Entity | Field | Validation Rule |
|--------|-------|----------------|
| User | `email` | Valid email format, max 255 chars, unique |
| User | `phone` | Saudi format: `+9665XXXXXXXX`, 12 digits |
| User | `password` | Min 12 chars, mixed case, number, special char |
| User | `name` | Min 2 chars, max 255 chars, Arabic or Latin script |
| User | `nationalId` | 10-digit Saudi national ID format |
| Property | `monthlyPrice` | Positive decimal, max 999,999.99 SAR |
| Property | `latitude` | Range: 16.0–32.5 (Saudi Arabia bounds) |
| Property | `longitude` | Range: 34.5–56.0 (Saudi Arabia bounds) |
| Property | `images` | Array of valid URLs, min 3, max 20 |
| Property | `bedrooms` | Integer 0–20 |
| Property | `area` | Positive decimal, max 10,000 sqm |
| Booking | `checkIn` | Future date, not before today |
| Booking | `checkOut` | After checkIn, min 30 days difference |
| Booking | `totalPrice` | Positive decimal, calculated server-side |
| Maintenance | `description` | Min 10 chars, max 2000 chars |
| Maintenance | `photos` | Max 5 images, each max 10MB, JPEG/PNG/WebP |
| Review | `rating` | Integer 1–5 |
| Review | `comment` | Max 1000 chars |

### 5.3 Ownership Rules (Who Can Read/Write What)

| Resource | Create | Read (Own) | Read (All) | Update | Delete |
|----------|--------|-----------|-----------|--------|--------|
| User profile | Self | Self | Admin | Self, Admin | Admin |
| Property | Landlord | Landlord | Public (active) | Landlord, Admin | Admin |
| Booking | Tenant | Tenant, Landlord | Admin | Landlord (status), Admin | Admin |
| Payment | System | Tenant, Landlord | Admin | System | Admin |
| Maintenance | Tenant | Tenant, Landlord | Admin | Landlord, Admin | Admin |
| Message | Tenant, Landlord | Participants | Admin | None (immutable) | Admin |
| Review | Tenant | Public | Public | Tenant (within 7 days) | Admin |
| Favorite | Tenant | Tenant | Admin | None | Tenant |
| Notification | System | Recipient | Admin | System (read status) | Recipient |

---

## 6. Future Roadmap (Phased)

### Phase 1: Stability & Hardening (Weeks 1–6)

Focus on resolving all Critical and High severity audit findings.

- Fix insecure JWT secret with startup validation
- Implement strong password policy
- Reduce session expiration, add refresh tokens
- Add foreign key constraints to MySQL schema
- Wrap multi-step DB operations in transactions
- Deploy Redis for caching and rate limiting
- Create CI/CD pipeline with GitHub Actions
- Add safe area CSS support
- Fix CSP directives

### Phase 2: Admin Panel & Automation (Weeks 7–14)

- Enhanced admin dashboard with real-time analytics
- Automated property sync with Beds24 (scheduled worker)
- Email notification system (booking confirmations, reminders)
- Property approval workflow
- Automated lease contract generation
- Landlord verification process

### Phase 3: Mobile App Readiness (Weeks 15–22)

- API stabilization and versioning (v1 prefix)
- Response caching strategy (ETags, conditional requests)
- Push notification infrastructure
- PWA support (service worker, offline mode)
- API documentation (OpenAPI/Swagger)
- Performance optimization (code splitting, image CDN)

### Phase 4: Enterprise Scaling (Weeks 23–30)

- Message queue integration (BullMQ/Redis) for async operations
- CDN deployment (Cloudflare) for static assets and images
- Database read replicas for query scaling
- Multi-region readiness (GCC expansion)
- Advanced analytics (custom dashboards, export)
- Stripe payment integration (alongside PayPal)

---

*End of Software Requirements Specification*
