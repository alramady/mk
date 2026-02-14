# Ijar - Monthly Rental Platform TODO

## Foundation
- [x] Database schema (users, properties, bookings, messages, maintenance, payments)
- [x] i18n system with Arabic/English translations
- [x] RTL-first layout system with LTR toggle
- [x] Saudi-inspired design system (colors, typography, theming)
- [x] Google Fonts setup (Tajawal + Inter)

## Property Listings
- [x] Property listing CRUD (create, read, update, delete)
- [x] Photo upload with S3 storage
- [x] Amenities checklist with icons
- [x] Pricing configuration (monthly rent, deposit, utilities)
- [x] Availability calendar (backend)
- [x] Location mapping with Google Maps integration
- [x] Property types (apartment, villa, studio, duplex, furnished room, compound, hotel apartment)

## Search & Discovery
- [x] Advanced search filters (location, price, type, amenities, date)
- [x] Grid/list view toggle
- [x] Map-based search view
- [x] Save favorites
- [x] Saved searches (backend)

## Tenant Dashboard
- [x] Bookings tab with status tracking
- [x] Payment history
- [x] Favorites tab
- [x] Maintenance requests tab
- [x] Notifications tab

## Landlord Dashboard
- [x] Property portfolio overview with stats
- [x] Listing management (create, view, edit)
- [x] Booking request management (approve/reject with reasons)
- [x] Tenant communication link
- [x] Revenue stats
- [x] Maintenance request management (acknowledge, start work, complete)

## Admin Dashboard
- [x] Platform overview (users, properties, bookings, revenue)
- [x] User management with role badges
- [x] Property moderation (approve/reject listings)
- [x] Booking overview

## Booking Flow
- [x] 4-step booking process (details, cost review, confirm, success)
- [x] Duration selection with min/max stay
- [x] Cost breakdown (rent, deposit, service fee)
- [x] Booking confirmation workflow

## Messaging System
- [x] Conversation list with chat interface
- [x] Message sending and receiving
- [x] Auto-refresh polling
- [x] Mobile-responsive layout

## Maintenance Requests
- [x] Request submission with photo uploads
- [x] Priority levels (low, medium, high, emergency)
- [x] Category selection (plumbing, electrical, HVAC, etc.)
- [x] Status tracking (submitted, acknowledged, in-progress, completed)
- [x] Landlord response workflow

## Payments
- [ ] Stripe integration setup
- [ ] Rent payment processing
- [ ] Security deposit handling
- [ ] Service fee collection
- [x] Payment tracking (backend)

## Landing Page
- [x] Hero section with search
- [x] Stats section
- [x] How it works section
- [x] Popular cities section
- [x] Footer with links

## Testing
- [x] Vitest tests for all routers (25 tests passing)

## Navigation & Routes
- [x] All routes registered in App.tsx
- [x] Navbar with all navigation links
- [x] Language toggle (AR/EN)
- [x] User profile dropdown

## Integration Tests (Real DB)
- [x] Real integration tests connecting to actual database (78 tests)
- [x] Test property CRUD lifecycle (create → read → update → delete)
- [x] Test booking lifecycle (create → approve → complete)
- [x] Test messaging lifecycle (create conversation → send messages → read)
- [x] Test maintenance request lifecycle (create → acknowledge → complete)
- [x] Test favorites (add → check → remove)
- [x] Test notifications (create → read → mark read)
- [x] Test user profile update
- [x] Test admin operations (stats, user management, property approval)
- [x] Test reviews and saved searches

## Local Authentication System
- [x] Remove Manus OAuth completely
- [x] Add userId/passwordHash columns to users table with bcrypt
- [x] Build login API endpoint (/api/auth/login with JWT cookie session)
- [x] Build register API endpoint (/api/auth/register)
- [x] Build login page UI (Arabic/English)
- [x] Build register page UI (Arabic/English)
- [x] Update useAuth hook for local auth
- [x] Seed admin account (Hobart / 15001500)
- [x] Update Navbar with login/register links
- [x] All 103 tests passing (78 integration + 24 unit + 1 auth)

## Seed Data - Saudi Properties
- [x] Seed script with 20+ diverse properties (20 properties seeded)
- [x] Properties across 8 Saudi cities (Riyadh, Jeddah, Dammam, Makkah, Madinah, Khobar, Abha, Tabuk)
- [x] Multiple property types (apartments, villas, studios, duplexes, compounds, hotel apartments, furnished rooms)
- [x] Realistic SAR pricing for each city (1,500 - 25,000)
- [x] Arabic and English titles/descriptions
- [x] Amenities, photos (CDN), and location data with coordinates
- [x] Sample landlord and tenant accounts (3 landlords + 2 tenants)
- [x] Knowledge base articles seeded (6 articles)
- [x] 2 pending properties for admin review workflow

## Digital Lease Contract
- [x] HTML contract generation endpoint (tRPC lease.generate)
- [x] Bilingual contract template (Arabic RTL + English)
- [x] Ejar-compliant terms and conditions (9 clauses)
- [x] Dynamic data population (tenant, landlord, property, dates, amounts)
- [x] Financial breakdown table (rent, deposit, service fee, total)
- [x] Signature blocks for both parties
- [x] Print and download HTML functionality
- [x] LeaseContract page with preview iframe (/lease/:bookingId)

## AI Assistant (إيجار الذكي)
- [x] System prompt with full platform knowledge (AR dialects + EN)
- [x] tRPC endpoint for AI chat with conversation history
- [x] Knowledge base integration with search
- [x] Role-aware responses (tenant vs landlord vs admin guidance)
- [x] Conversation history saved in database
- [x] Floating chat button UI with RTL support
- [x] Chat interface with message history
- [x] Quick suggestion buttons
- [x] Conversation management (new, list, continue)
- [ ] Response rating system (1-5 stars)
- [ ] Admin knowledge base management page

## Knowledge Base Management Page (Admin)
- [x] tRPC endpoints for KB CRUD (list, create, update, delete articles)
- [x] Admin-only access control on all KB management endpoints
- [x] KB Management page UI with article list table
- [x] Create/Edit article dialog with title (AR/EN), content (AR/EN), category, tags
- [x] Delete article with confirmation dialog
- [x] Search and filter articles by category/title
- [x] Route registered in App.tsx
- [x] Link added to Admin Dashboard navigation
- [ ] Article status toggle (published/draft)

## Comprehensive Admin CMS (Full Site Control)
- [x] Platform settings DB table with key-value pairs for all site config
- [x] Seed default settings (site name, logo, hero text, stats, colors, fees, etc.)
- [x] tRPC endpoints: getSettings (public), updateSettings (admin), uploadAsset (admin)
- [x] SiteSettingsProvider React context — loads all settings, provides to all pages
- [x] Admin CMS Page — Site Identity (name AR/EN, logo upload, favicon, description)
- [x] Admin CMS Page — Hero Section (title AR/EN, subtitle AR/EN, background image)
- [x] Admin CMS Page — Stats Section (editable numbers and labels)
- [x] Admin CMS Page — Platform Fees (service fee %, VAT, min/max rent, deposit rules)
- [x] Admin CMS Page — Footer Content (about text, contact info, social links)
- [x] Admin CMS Page — Terms & Conditions / Privacy Policy (AR/EN)
- [x] Admin CMS Page — Knowledge Base CRUD (articles, FAQs)
- [x] Update Navbar to use dynamic site name + logo from settings
- [x] Update Home page hero to use dynamic content from settings
- [x] Update Home page stats to use dynamic numbers from settings
- [x] Update Footer to use dynamic content from settings
- [ ] Admin CMS Page — Featured Cities (add/remove/reorder cities)
- [x] Update BookingFlow to use dynamic service fee from settings

## User Activity Tracking & Analytics
- [x] userActivities DB table (userId, action, page, metadata, ip, timestamp)
- [x] Track user page views, searches, favorites, bookings (endpoints ready)
- [x] Activity stats endpoint (totalActions, uniqueUsers, topActions)
- [x] Activity log with filters (by user, by action, with pagination)
- [x] User preferences analysis (search patterns, viewed properties)
- [ ] Admin analytics dashboard with charts UI
- [ ] Export analytics data

## Saudi City Districts (Complete)
- [x] Districts data for Riyadh (50+ districts seeded)
- [x] Districts data for Jeddah (50+ districts seeded)
- [x] Districts data for Madinah (50+ districts seeded)
- [x] Integrate districts into search filters
- [x] Bilingual district names (AR/EN)
- [x] Admin CRUD endpoints for districts
- [ ] Districts data for Makkah, Dammam, Khobar, Tabuk, Abha

## Admin Roles & Permissions
- [x] adminPermissions DB table (userId, permissions JSON, isRootAdmin)
- [x] Permission types: manage_users, manage_properties, manage_bookings, manage_settings, manage_kb, view_analytics
- [x] Admin permissions management endpoints (list, get, set, delete)
- [x] Root admin protection (cannot be modified/deleted)
- [ ] Admin permissions management UI page
- [ ] Permission checks on individual admin endpoints

## Translation Fixes (100% Correct)
- [ ] Audit all Arabic translations — ensure 100% Arabic with no English
- [ ] Audit all English translations — ensure 100% English with no Arabic
- [ ] Fix any mixed-language issues in UI components
- [ ] Verify RTL layout consistency across all pages

## CMS Tests
- [x] Districts API tests (3 tests)
- [x] Site Settings API tests (5 tests)
- [x] User Activity API tests (3 tests)
- [x] Admin Permissions API tests (2 tests)
- [x] Public Settings API test (1 test)
- [x] All 117 tests passing (4 test files)

## City & District Management System
- [x] Cities table (nameAr, nameEn, region, regionAr, latitude, longitude, imageUrl, isActive, sortOrder)
- [x] Districts table updated with cityId FK, sortOrder, timestamps
- [x] City CRUD endpoints (create, read, update, delete, toggle)
- [x] District CRUD endpoints (create, read, update, delete, toggle, bulk create)
- [x] Admin management page with tabs (Cities / Districts)
- [x] City form dialog (add/edit with AR/EN names, region, coordinates, image, sort order)
- [x] District form dialog (add/edit with city selection, AR/EN names, coordinates, sort order)
- [x] Delete confirmation dialogs
- [x] Search/filter for cities and districts
- [x] Stats cards (total cities, active cities, total districts, active districts)
- [x] Link from Admin Dashboard to city management
- [x] Update search page to use only active cities/districts from DB
- [x] Seed 8 Saudi cities with regions and coordinates
- [x] Tests for city and district CRUD operations (13 tests, all passing)
- [x] All 130 tests passing (5 test files)

## Design Redesign - CoBnB KSA Style Match
- [x] Fix esbuild error in routers.ts line 897
- [x] Rewrite CSS theme: dark navy #0B1E2D, teal accent #3ECFC0, gold #C9A96E
- [x] Rewrite Navbar: dark navy sticky, teal accents, RTL menu
- [x] Rewrite Home page: hero (dark navy bg, badge, large heading, two CTAs)
- [x] Home: stats bar with animated counters in teal
- [x] Home: services grid (6 cards) on light gray bg with teal icons
- [x] Home: "how it works" 3 steps on dark bg
- [x] Home: featured properties carousel
- [x] Home: cities section with district counts
- [x] Home: testimonials carousel
- [x] Home: CTA section "حقق أقصى استفادة من عقارك"
- [x] Rewrite Footer: dark navy, teal accents
- [x] Update all pages to use new dark/teal theme (Login, Register, KnowledgeBase, LandlordDashboard, CityDistrict, etc.)
- [x] Configurable rental duration (dynamic from CMS settings)
- [x] Update booking flow validation with dynamic limits
- [x] WhatsApp floating button (CMS-configurable)

## Configurable Rental Duration Limits
- [x] Add rental.minMonths and rental.maxMonths to platform_settings seed defaults
- [x] Add rental duration fields to Admin CMS page (Platform Fees section)
- [x] Update BookingFlow to read min/max months from site settings
- [x] Update backend booking validation to use dynamic limits from settings
- [x] Update property creation form to show dynamic duration info
- [x] Write vitest tests for dynamic rental duration validation (6 tests, all passing)

## WhatsApp Floating Button
- [x] Create WhatsApp floating button component
- [x] Add whatsapp.number to CMS settings (configurable from admin)
- [x] Add whatsapp.message default text to CMS settings
- [x] Position bottom-right with pulse animation

## Expanded CMS Controls
- [x] Verify rental duration limits work end-to-end (CMS → backend → frontend)
- [x] Make service fee % dynamic from CMS in BookingFlow cost calculation
- [x] Make VAT % dynamic from CMS in cost calculations
- [x] Make deposit months dynamic from CMS
- [x] Add CMS controls for primary/accent colors (in site identity tab)
- [x] Ensure all CMS changes reflect immediately on the site

## Motion & Animation Effects
- [x] Scroll-triggered fade-in animations for sections (useScrollAnimation hook)
- [x] Card hover effects (lift, shadow, scale)
- [x] Staggered entrance animations for grids
- [x] Counter animation for stats numbers (useCountUp hook)
- [x] Parallax effect on hero section (floating particles)
- [x] Button hover micro-interactions (btn-animate class)
- [x] Page transition animations
- [x] Navbar scroll effect (backdrop-blur + shadow on scroll)
- [x] Floating elements animation in hero (animated dots)
- [x] Smooth reveal for testimonials (scroll-triggered)

## Content Update
- [x] Update default CMS content to match Ijar monthly rental identity
- [x] Update hero text, stats, services descriptions
- [x] Update footer content
