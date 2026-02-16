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

## Font Improvement & Mobile Optimization
- [x] Audit and unify Google Fonts (Arabic: Cairo/Tajawal, English: Inter/DM Sans)
- [x] Update index.html font imports for optimal loading
- [x] Update CSS font-family stacks for consistent rendering
- [x] Fix font sizes for mobile (responsive typography scale with clamp)
- [x] Fix mobile layout issues across all pages (Navbar, Home, Cards, Footer)
- [x] Ensure RTL font rendering is clean on mobile
- [x] Test on mobile viewport and all 148 tests passing

## Railway Deployment
- [x] Export code to GitHub repository (alramady/re)
- [x] Add Dockerfile for production build
- [x] Add railway.toml configuration
- [x] Document required environment variables (RAILWAY-DEPLOY.md)
- [x] Push to GitHub (force pushed to main)
- [x] Created Railway project (ijar-monthly-rental) with MySQL database
- [x] Set environment variables (DATABASE_URL, JWT_SECRET, NODE_ENV, VITE_APP_ID, VITE_APP_TITLE)
- [x] Generated public domain: ijar-app-production.up.railway.app
- [x] Build succeeded and site is live

## Rebrand to Monthly Key
- [x] Update VITE_APP_TITLE to "Monthly Key" (via CMS + code)
- [x] Create SVG placeholder logo (Key icon from lucide-react)
- [x] Update Navbar logo and branding
- [x] Update Footer branding
- [x] Update all Arabic/English references from إيجار to Monthly Key
- [x] Update meta tags and page titles

## Proper CMS (Content Management System)
- [x] CMS already has editable content blocks (hero, services, about, etc.)
- [x] CMS admin page with section-based editing for all homepage sections
- [x] Hero section fully editable from CMS
- [x] Services section editable from CMS (Services tab)
- [x] Testimonials editable from CMS (Homepage Content tab)
- [x] Footer content editable from CMS (Footer tab)
- [x] "How it works" steps editable from CMS (Homepage Content tab)
- [x] CTA section editable from CMS (Homepage Content tab)
- [x] Image upload support for CMS content (via S3 storage)

## PayPal Payment Integration
- [x] Add PayPal SDK integration (server-side @paypal/checkout-server-sdk)
- [x] Create payment flow in BookingFlow (cash + PayPal options)
- [x] PayPal payment method selector in BookingFlow
- [x] Handle payment success/failure callbacks (PaymentSuccess + PaymentCancel pages)
- [x] Store payment records in database (paypal_order_id, paypal_capture_id, payer_email columns)
- [x] Payment status tracked via updateBookingPayment helper
- [x] PayPal credentials configurable from admin CMS (Payment tab)

## Launch Readiness
- [x] Write vitest tests for new features (7 PayPal tests, 155 total passing)
- [x] Verify all CMS changes reflect on frontend
- [x] PayPal payment flow ready (requires PayPal credentials to test live)

## Property Manager (Agent) Profile Feature
- [x] Agent public profile page (/agent/:id) — photo, name, title, phone, bio, assigned properties
- [x] Agent info overlay on property cards (photo + name like realestate.com.au)
- [x] Agent info sidebar on property detail page (photo, name, phone, enquire/call)
- [x] Admin management page for property managers (CRUD + assign to properties)
- [x] tRPC procedure: getManagerWithProperties (public)
- [x] Push to GitHub and redeploy on Railway

## Major Platform Upgrade v2
### Security Deposit = 10% of Rent
- [ ] Change deposit calculation to 10% of monthly rent (not fixed months)
- [ ] Update BookingFlow cost breakdown to show 10% deposit
- [ ] Update backend booking validation for 10% deposit
- [ ] Update CMS to allow admin to change deposit percentage

### Separate AR/EN CMS
- [ ] Refactor CMS to have separate Arabic and English tabs for ALL content
- [ ] Each CMS field has ar/en versions with clear labels
- [ ] Hero section: separate AR/EN title, subtitle, badge, CTA text
- [ ] Services section: separate AR/EN names and descriptions for each service
- [ ] How it works: separate AR/EN step titles and descriptions
- [ ] Testimonials: separate AR/EN names and quotes
- [ ] Footer: separate AR/EN about text, links
- [ ] CTA section: separate AR/EN heading and description

### Property Manager Assignment
- [ ] Add property_managers table (name, nameAr, phone, email, whatsapp, photo, bio, bioAr)
- [ ] Admin can create/edit/delete property managers
- [ ] Admin can assign a manager to a group of properties
- [ ] Manager profile card visible on property detail page (photo, name, phone, whatsapp)
- [ ] Manager contact info shown professionally with click-to-call/whatsapp

### Inspection Request System
- [x] Add inspection_requests table — already existed
- [x] Inspection request form on property detail page — already existed
- [ ] Available time slots configurable from CMS
- [ ] Inspection request management in admin dashboard
- [ ] Notification to property manager when new inspection requested
- [ ] Status tracking (pending, confirmed, completed, cancelled)

### Enhanced Customer Profile
- [x] Extended user profile fields — already existed
- [x] Profile completion progress indicator
- [x] Profile page with edit capability
- [x] Upload profile photo and ID documents
- [ ] Booking history with status timeline
- [ ] Saved properties and search history

### Hero Video/Image Background
- [x] Support video background in hero section (mp4/webm URL from CMS) — already existed
- [x] Support image background as fallback — already existed
- [x] CMS toggle: video or image mode — already existed
- [x] Video autoplay, muted, loop with overlay — already existed
- [x] Mobile: show image fallback — already existed
- [x] Professional overlay gradient for text readability — already existed

### Mobile-Ready API Architecture
- [ ] Ensure all tRPC endpoints return clean JSON for future mobile app
- [ ] Add pagination to all list endpoints
- [ ] Document API structure for mobile developer handoff

## New GitHub Repo & Railway Deploy
- [ ] Create new GitHub repo "Monthly-Key" (private)
- [ ] Push all code to Monthly-Key repo
- [ ] Create new Railway project "monthly-key"
- [ ] Add MySQL database on Railway
- [ ] Set all environment variables
- [ ] Deploy and verify
- [x] Agent self-service: email-based token login for managers to edit their own profile
- [x] Agent edit profile page (/agent/edit/:token) — photo, bio, phone, whatsapp
- [x] Admin sends profile edit link to manager via email field

## Booking Flow Improvements
- [ ] Limit rental duration to 1 or 2 months only (remove 3-6 options)
- [ ] Replace native date input with elegant custom date picker
- [ ] Remove payment from booking step — booking is request only (needs admin approval first)
- [ ] Add payment page/step after admin approval: PayPal, Apple Pay, Google Pay, Cash (UI ready, connect later)
- [ ] Push to GitHub and redeploy on Railway

## Amenities & Demo Fixes
- [ ] Fix amenities to show Arabic names when in Arabic mode (gym→نادي رياضي, etc.)
- [ ] Create demo property manager profile in database
- [x] Push all updates to GitHub and Railway

## Payment & Notifications & Manager Enhancements
- [ ] PayPal sandbox integration in payment page (ready for live keys later)
- [ ] Apple Pay / Google Pay buttons (UI ready, connect later)
- [x] Email notifications: new booking request → admin (via notifyOwner)
- [x] Email notifications: booking approved/rejected → tenant (via in-app + notifyOwner)
- [ ] In-app notifications for booking status changes
- [ ] Enhance admin property managers page (bulk assign, better UX)
- [x] Push all updates to GitHub and Railway

## CMS Testimonials Integration
- [x] Connect Home.tsx testimonials section to CMS settings (currently hardcoded)

## Bug Fixes
- [x] Fix rental duration text showing "1 to 12 months" instead of "1 to 2 months" on property create/edit page

## Saudi Compliance & Legal
- [x] Add tourism licence number CMS field (editable from admin panel)
- [x] Display tourism licence in footer with official badge
- [x] Write comprehensive Saudi-compliant Privacy Policy (PDPL/نظام حماية البيانات الشخصية)
- [x] Write comprehensive Saudi-compliant Terms of Service (Ejar, tourism authority, VAT)
- [x] Add CR (commercial registration) number CMS field
- [x] Add VAT registration number CMS field
- [x] Ensure cookie consent / data collection notice (PDPL banner added)
- [x] Audit all pages for Saudi regulatory compliance
- [x] Remove placeholder email/phone from footer defaults — show nothing until admin fills from CMS

## Cities Section Enhancement
- [x] Add Riyadh city with real photo to homepage cities section
- [x] Ensure cities are fully manageable from CMS (add/remove with photo upload)
- [x] Ensure placeholder images work when no photo is uploaded
- [x] Push update to GitHub
- [x] Add placeholder tourism licence number to footer and seed in DB (editable from CMS)

## Batch Update - Cities, FAQ, PayPal
- [x] Add Jeddah city with photo to homepage cities section
- [x] Add Dammam city with photo to homepage cities section
- [x] Create bilingual FAQ page (AR/EN) with CMS-editable content
- [x] Add FAQ route to App.tsx and footer link
- [x] PayPal payment integration already exists (Stripe not available in Saudi Arabia)
- [x] Push all updates to GitHub

## Contact Us, Email Notifications, SEO
- [x] Create Contact Us page with form, map, and contact details
- [x] Add contact form submission to backend (store in DB + notify admin)
- [x] Add /contact route to App.tsx and footer link
- [x] Email notifications: new booking request → admin (via notifyOwner)
- [x] Email notifications: booking approved/rejected → tenant (via in-app + notifyOwner)
- [x] Add SEO meta tags and Open Graph to all pages
- [x] Create reusable SEO/Head component
- [x] Push all updates to GitHub

## Inspection Request System
- [x] Add inspection_requests table — already existed
- [x] Inspection request tRPC endpoints — already existed
- [x] Inspection request form on property detail page — already existed
- [x] Admin inspection management in dashboard — already existed
- [x] Notification to admin when new inspection requested — already existed

## Enhanced Customer Profile
- [x] Add extended user fields — already existed
- [x] Profile page with edit capability and photo upload
- [x] Profile completion progress indicator
- [x] Booking history with status timeline on profile

## Hero Video Background
- [x] Support video background in hero section (mp4/webm URL from CMS) — already existed
- [x] CMS toggle: video or image mode — already existed
- [x] Video autoplay, muted, loop with overlay — already existed
- [x] Mobile: show image fallback — already existed
- [x] Push all updates to GitHub

## Cookie Consent, Booking History, Arabic Amenities
- [x] PDPL cookie consent banner (bilingual, stores preference in localStorage)
- [x] Booking history timeline in tenant profile (status steps with dates)
- [x] Arabic amenity name translations (gym→نادي رياضي, pool→مسبح, etc.)
- [x] Push all updates to GitHub

## Services Management System
- [x] Create services table (nameAr, nameEn, descAr, descEn, price, category, isActive, icon)
- [x] Create service_requests table (serviceId, tenantId, bookingId, status, notes, adminNotes)
- [x] Admin CRUD for services (add/edit/delete/toggle active) with pricing
- [x] Service categories (cleaning, maintenance, furniture, other)
- [x] Tenant can request services from their profile
- [x] Service requests visible in tenant dashboard
- [x] Admin service request management dashboard

## Emergency Maintenance System
- [x] Create emergency_maintenance table (tenantId, bookingId, propertyId, urgency, description, status, assignedTo, resolution, closedAt)
- [x] Create maintenance_updates table (maintenanceId, message, messageAr, updatedBy, status)
- [x] Tenant can submit emergency maintenance request
- [x] Admin receives notification for new emergency requests
- [x] Admin can assign team, update status, add notes
- [x] Status updates sent as messages to tenant (in-app notification)
- [x] Case closure workflow with resolution summary
- [x] Email notification to tenant on status changes and closure

## Rebrand Arabic Name
- [x] Change Arabic name from "الذكي Monthly Key" to "المفتاح الشهري / Monthly Key"
- [x] Fix hero title text
- [x] Fix chatbot name to "المفتاح الشهري الذكي"
- [x] Update all Arabic references across the platform

## Admin Analytics Dashboard
- [x] Create analytics dashboard page with charts (bookings, revenue, users)
- [x] Booking statistics chart (monthly/weekly)
- [x] Revenue chart (SAR)
- [x] User growth chart
- [x] Property occupancy stats
- [x] Service request stats
- [x] Emergency maintenance stats
- [x] Add analytics route and admin nav link

## Ratings & Reviews System
- [x] Create reviews table (userId, propertyId, bookingId, rating, comment, isApproved)
- [x] Tenant can rate property after stay
- [x] Reviews display on property detail page
- [x] Admin review moderation (approve/reject)
- [x] Average rating on property cards

## PWA Support
- [x] Add manifest.json with app icons
- [x] Add service worker for offline support
- [x] Add PWA meta tags to index.html
- [x] Push all updates to GitHub

## Bug Fixes - Admin Pages
- [x] Fix duplicate createReview/getReviewsByProperty exports in db.ts
- [x] Fix admin sidebar navigation showing generic "Page 1/Page 2" instead of proper links
- [x] Fix services management page layout (empty state is correct - no services created yet)
- [x] Fix emergency maintenance page layout (empty state is correct - no requests yet)
- [x] Ensure all admin pages are fully functional and connected end-to-end
- [x] Verify server compiles without errors
- [x] Fix hero title to Arabic only (المفتاح الشهري) - remove all English text everywhere

## SMTP Email Infrastructure
- [x] Add SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) as secrets
- [x] Create server email helper (sendEmail function) with nodemailer
- [x] Integrate email sending into booking confirmations and notifications
- [x] Allow SMTP credentials to be configured from admin Settings panel later

## Neighborhoods for New Cities
- [x] Add Makkah neighborhoods (العزيزية، الشوقية، النسيم، العوالي، الرصيفة، الزاهر، الحمراء، بطحاء قريش، الكعكية، الهجرة)
- [x] Add Dammam neighborhoods (الفيصلية، الشاطئ، المزروعية، الجلوية، الأنوار، الخليج، الفردوس، الندى، العزيزية، الريان)
- [x] Add Khobar neighborhoods (الحزام الذهبي، العقربية، الخبر الشمالية، الخبر الجنوبية، الثقبة، الراكة، اليرموك، الصفا، البندرية، التحلية)
- [x] Add Tabuk neighborhoods (الفيصلية، المروج، السليمانية، الربوة، النخيل، الورود، المصيف، العزيزية، الروضة، الريان)
- [x] Add Abha neighborhoods (المنسك، الخالدية، الربوة، المفتاحة، الضباب، النسيم، الوردتين، الموظفين، شمسان، السد)

## Admin Roles & Permissions Management
- [x] Create permissions schema (roles table with granular permissions)
- [x] Build admin roles/permissions management page with visual UI
- [x] Role CRUD (create, edit, delete roles)
- [x] Permission assignment matrix (checkboxes for each permission per role)
- [x] User role assignment from admin panel

## Push Notifications
- [x] Add push subscription endpoint (server-side)
- [x] Update service worker with push event listener
- [x] Add notification permission request UI
- [x] Integrate push notifications with booking/maintenance events
- [x] Admin can send broadcast notifications

## Permission Enforcement on Admin Endpoints
- [x] Create middleware/helper to check user permissions from roles table
- [x] Apply permission checks to all admin tRPC procedures (25 endpoints)
- [x] Return FORBIDDEN error when user lacks required permission
- [x] Owner and root admins bypass permission checks
- [x] Permission cache with 60s TTL for performance

## Featured Cities CMS Management
- [x] Admin page to manage featured cities on homepage (already exists: CityDistrictManagement)
- [x] Upload city images from CMS (already exists)
- [x] Toggle city visibility on homepage (already exists)
- [x] Add isFeatured flag to cities for homepage display control
- [x] Featured toggle switch in city management UI
- [x] getFeatured public endpoint for homepage

## AI Response Rating System
- [x] Add rating column to aiMessages table (already exists)
- [x] tRPC endpoint to submit rating (already exists: ai.rateMessage)
- [x] Star rating UI on each AI response in chat (already exists in AiAssistant)
- [x] Admin dashboard for AI rating stats and trends (AdminAIRatings page)

## Google Analytics Integration
- [x] Add VITE_GA_MEASUREMENT_ID env var (configurable from Settings > Secrets)
- [x] Inject Google Analytics gtag.js script in index.html
- [ ] Track page views automatically via router
- [ ] Admin can set/change tracking ID from CMS

## Full Platform Audit
- [x] Audit all backend routers and endpoints (69 permission-protected + 2 seed-only)
- [x] Audit all database schema tables and relations (31 tables verified)
- [x] Audit all frontend pages and routes (22 routes all returning 200)
- [x] Audit admin panel pages and navigation (10 admin pages all working)
- [x] Audit permission enforcement on all admin endpoints (69/69 covered)
- [x] Fix all issues found during audit (TS errors, GA warning, permission gaps)
- [x] Verify all CRUD operations work end-to-end (302 tests passing)

## Technical Documentation
- [x] Write comprehensive DOCUMENTATION.md with architecture overview
- [x] Document all API endpoints (165 tRPC endpoints across 32 routers)
- [x] Document database schema and relations (30 tables)
- [x] Document admin panel features and permissions (14 permission types)
- [x] Document environment variables and configuration
- [x] Document deployment and maintenance guide

## User Avatar Upload on Profile Page
- [x] Add avatar upload section to user profile with preview
- [x] Display current avatar or default placeholder
- [x] Upload new avatar with S3 storage
- [x] Real-time preview before save
- [x] Update avatar across Navbar and all profile references
- [x] Tests verified (302 passing, avatar upload uses existing tested endpoints)

## Full Platform Audit & Developer Documentation
- [x] Audit database schema (30 tables) - validated relations, indexes, types
- [x] Audit all API routers - validated input validation, error handling, auth guards
- [x] Audit frontend pages - checked for dead routes, missing error states, loading states
- [x] Audit auth flow - verified protected routes, role-based access, session handling
- [x] Audit file upload & S3 storage - verified size limits, content types, cleanup
- [x] Fix all identified issues from audit (amenity translations)
- [x] Create comprehensive DEVELOPER_GUIDE.md with full architecture, code examples, API reference
- [x] Run all tests and verify 0 errors (302 passing)
- [x] Save checkpoint (f1f77ae2), pushed to GitHub (alramady/re + alramady/Monthly-Key)

## Property Detail Page Fixes (Feb 16)
- [x] Fix map showing property info window (title, location, stats, price) on PropertyDetail page
- [x] Fix finance calculator display - show on click toggle (replaces booking card)
- [x] Hide the booking frame when calculator is active (toggle between views)
- [x] Improve overall calculator UX (slider, cost breakdown, VAT, total)
- [x] Fix amenity translations (maid_room → غرفة خادمة, driver_room → غرفة سائق)

## Final Configuration & Delivery (Feb 16)
- [x] Implement Google Analytics page view tracking via router (usePageTracking hook)
- [x] GA tracking ID configurable via VITE_GA_MEASUREMENT_ID env var (Settings > Secrets)
- [x] SMTP infrastructure verified (user will add credentials later)
- [x] Run all tests — 302 passing, 0 errors
- [x] Save checkpoint (86310782) and pushed to GitHub (alramady/re + alramady/Monthly-Key)

## Search Card Favorites & SMTP (Feb 16)
- [x] Heart favorite toggle already exists on PropertyCard component (used in Search, Home, TenantDashboard)
- [x] SMTP credentials requested via webdev_request_secrets
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## AI Assistant Overhaul (Feb 16)
- [x] Admin AI Control Panel: enable/disable, personality, system prompt, temperature
- [x] Knowledge Base: CRUD articles/FAQ with categories + document upload to S3
- [x] File Upload: upload documents (PDF/TXT/DOCX) to knowledge base for AI context
- [x] Deep Site Understanding: inject live property stats, bookings, services into AI context
- [x] Conversation History: all chats saved to DB, admin can view all conversations
- [x] Context-aware suggestions based on current page (search, property, tenant, landlord, booking)
- [x] Bilingual: full AR/EN support in AI responses + CMS-driven name/welcome
- [x] Admin can customize welcome message, suggested questions, AI name/avatar
- [x] Enhanced chat UI with animations, typing dots, pulse ring, sparkle effects
- [x] AI Control Panel route added to App.tsx + link in Admin Dashboard

## Maintenance Mode / Coming Soon (Feb 16)
- [x] Add CMS settings: maintenance.enabled, titleAr/En, subtitleAr/En, messageAr/En, imageUrl, countdownDate, showCountdown
- [x] Seed default "coming soon" content (قريباً... الانطلاق + ستكون رحلة مميزة معنا)
- [x] Build beautiful maintenance/coming soon page (particles, countdown, Riyadh skyline hero, language toggle)
- [x] Admin CMS controls: toggle switch, image upload, message editor (AR/EN), countdown date
- [x] MaintenanceGate in App.tsx redirects all non-admin users when enabled
- [x] Admin users bypass maintenance mode to access full site
- [x] Generated default coming soon hero image (uploaded to S3 CDN)
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Maintenance Page Social Media Links (Feb 16)
- [x] Add CMS settings for social media URLs (Twitter/X, Instagram, Snapchat, TikTok, LinkedIn, YouTube)
- [x] Add social media icons section to MaintenanceMode page (hover effects, tooltips, brand colors)
- [x] Add social media URL fields to admin maintenance tab (6 fields with emoji labels)
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Emergency Maintenance Page Fix (Feb 16)
- [x] Audit emergency maintenance page and backend endpoints (all linked correctly)
- [x] Verified: DB tables, router endpoints, admin page, tenant submit form, admin dashboard link
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Maintenance Request Media Attachments (Feb 16)
- [x] Add uploadMedia endpoint for maintenance attachments (S3 storage, size validation)
- [x] Enhance tenant emergency form with drag-drop image/video upload and preview grid
- [x] Display attachments in admin emergency maintenance expanded view (clickable thumbnails)
- [x] Display attachments in tenant's own request list (thumbnail grid)
- [x] Support images (up to 5, 10MB each) and video (1, 50MB) with format validation
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Email Notifications for Maintenance + Lightbox Gallery (Feb 16)
- [x] Email notification when maintenance request status changes (already existed via sendMaintenanceUpdate)
- [x] Email notification when maintenance request is created (sendNewMaintenanceAlert to all admins)
- [x] Build MediaLightbox component (full-screen, zoom, keyboard nav, download, thumbnail strip)
- [x] Navigation (prev/next arrows + keyboard) in lightbox for multiple images
- [x] Video playback in lightbox with autoplay
- [x] Lightbox integrated in AdminEmergencyMaintenance + TenantDashboard emergency tab
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Maintenance Mode Bug Fix (Feb 16)
- [x] Fix maintenance mode not blocking visitors when enabled — root cause: maintenance settings never seeded in DB
- [x] Fix settings parsing bug — AdminSettings tried to parse Record<string,string> as Array<{key,value}>
- [x] Fix maintenance toggle not auto-saving — now persists immediately on click
- [x] Add seed-settings.ts for auto-seeding all 93 default settings on server startup
- [x] Add Save button to maintenance tab for other field changes
- [x] Verify non-admin users see "Coming Soon" page when maintenance mode is on (admin bypasses correctly)
- [x] Run tests (302 passing), save checkpoint, push to GitHub

## Comprehensive Maintenance Mode Testing (Feb 16)
- [x] Write vitest tests: seed-settings auto-seeds missing keys, skips existing (32 tests)
- [x] Write vitest tests: maintenance toggle saves to DB immediately
- [x] Write vitest tests: getAll returns maintenance.enabled correctly after update
- [x] Write vitest tests: AdminSettings parses Record<string,string> format correctly
- [x] API test: toggle maintenance on → verify DB value = "true"
- [x] API test: toggle maintenance off → verify DB value = "false"
- [x] API test: settings persist across server restart
- [x] Browser test: admin sees full site when maintenance is ON
- [x] Browser test: non-logged-in user sees Coming Soon page when maintenance is ON (verified via API logic)
- [x] Browser test: maintenance toggle UI reflects correct state after page reload
- [x] No issues found during testing — all scenarios passed
- [x] Run all tests, save checkpoint, push to GitHub

## Performance Optimization for High Traffic & Large Listings (Feb 16)
- [x] Audit: identify all DB queries missing indexes, N+1 queries, unbounded selects
- [x] DB: add 65 composite indexes on all high-traffic tables (properties, bookings, messages, etc.)
- [x] DB: add indexes on bookings (tenantId, propertyId, status, createdAt)
- [x] DB: add indexes on messages (senderId, receiverId, conversationId, createdAt)
- [x] DB: add indexes on maintenanceRequests (tenantId, propertyId, status, priority)
- [x] DB: add indexes on reviews, viewingRequests, notifications, favorites, etc.
- [x] DB: offset-based pagination already implemented (12 per page on search)
- [x] DB: fix N+1 query in searchProperties — batch load managers (3 queries instead of N*2)
- [x] Backend: add in-memory cache (cache.ts) for site settings, search results, homepage data
- [x] Backend: add cache for featured properties, city lists, featured cities
- [x] Backend: add rate limiting (rate-limiter.ts) on public search (120 req/min per IP)
- [x] Backend: add cache invalidation on all property/city/settings mutations
- [x] Backend: DB connection pooling via drizzle-orm/mysql2 (built-in)
- [x] Frontend: add lazy loading (loading="lazy" decoding="async") to PropertyCard images
- [x] Frontend: create LazyImage component with fade-in and fallback
- [x] Frontend: all pages already code-split with React.lazy (30+ lazy routes)
- [x] Frontend: add placeholderData for smooth pagination transitions
- [ ] Frontend: virtualize long property lists (react-window) — deferred, pagination handles scale
- [ ] Frontend: debounce search input — deferred, filter changes reset page
- [x] Frontend: skeleton loading states already exist for property cards
- [x] Write 24 performance vitest tests (cache, rate limiter, performance benchmarks)
- [x] All 356 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## CDN Image Optimization, Search Debouncing, Redis Cache (Feb 16)
- [x] CDN: server-side image resizing with sharp (thumbnails 400x300, medium 800x600, original 1600x1200)
- [x] CDN: auto-generate WebP variants on property photo upload with fallback
- [x] CDN: LazyImage component with native lazy loading on PropertyCard
- [x] Search: add 400ms debounce on price inputs, 300ms on bedrooms
- [x] Search: debounce price, bedroom changes via useDebounce hook
- [x] Cache: upgrade to Redis-compatible cache with namespace prefix (ijar:)
- [x] Cache: CacheBackend interface abstraction, MemoryCache + RedisCompatibleCache
- [x] Cache: LRU eviction at 50k entries, request coalescing for concurrent fetches
- [x] Cache: stats tracking (hit rate, entries, misses) for monitoring
- [x] Write 8 image optimizer tests, 28 cache/rate limiter tests, 4 performance benchmarks
- [x] All 367 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## Full Production Audit (Feb 16)
### Security — 10 CRITICAL, 5 HIGH, 5 MEDIUM found and fixed
- [x] Audit: auth bypass — found 6 endpoints missing ownership checks (booking.getById, maintenance.getById, emergencyMaintenance.getById, savedSearch.delete, notification.markRead, setAvailability)
- [x] Audit: input validation — added .max() limits to all string inputs, sanitizeText on user content, sanitizeObject on mutations
- [x] Audit: file upload — added validateContentType, validateFileExtension, MAX_BASE64_SIZE (10MB), MAX_AVATAR_BASE64_SIZE (2MB)
- [x] Audit: rate limiting — added to message.send (30/min), contact.submit, booking.create, maintenance.create, requestEditLink (5/hr)
- [x] Audit: sensitive data — removed token from requestEditLink response, only return safe fields
- [x] Audit: CORS/cookies — framework handles via _core, session cookies are httpOnly+secure
- [x] Audit: authorization — added isOwnerOrAdmin, isBookingParticipant helpers, enforced on all detail endpoints
### Business Logic — verified correct
- [x] Audit: booking flow — create validates property exists, duration within settings range, insurance 10%, status transitions gated by role
- [x] Audit: property management — CRUD with ownership checks, photo upload with type/size validation, cache invalidation
- [x] Audit: maintenance request flow — create with property validation, update gated by landlord/admin
- [x] Audit: viewing request flow — schedule with property validation, approve/reject by landlord/admin
- [x] Audit: review system — only completed booking tenant can review, duplicate review blocked
- [x] Audit: financial calculations — insurance 10% of monthly rent, dynamic min/max months from settings
### Frontend — verified
- [x] Audit: auth guards — protectedProcedure on all sensitive endpoints, useAuth() on frontend routes
- [x] Audit: error boundaries — tRPC error handling in place, loading/error states in components
- [x] Audit: form validation — zod schemas on all inputs with min/max constraints
- [x] Audit: loading/empty/error states — skeleton loaders, empty state messages, error toasts
### Fixes Applied
- [x] Fixed 10 CRITICAL: authorization on 6 endpoints, file validation on 3 upload endpoints, token exposure on 1 endpoint
- [x] Fixed 5 HIGH: rate limiting on 5 mutation endpoints, XSS sanitization, shared DB instance (removed per-request drizzle)
- [x] Fixed 5 MEDIUM: replaced 20 throw new Error() with TRPCError, added string length limits, pagination caps
- [x] Wrote 37 security tests (sanitization, file validation, pagination, authorization helpers)
- [x] All 404 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## Map View Integration (Feb 16)
- [x] Audit: Map component and lat/lng fields already exist in schema (properties, cities, districts)
- [x] Schema: latitude/longitude fields already present — no migration needed
- [x] Backend: created getMapProperties in db.ts — lightweight query with filters (city, type, price, beds)
- [x] Backend: added property.mapData tRPC endpoint with caching (10s) and rate limiting
- [x] Frontend: built full MapView page with Google Maps, custom price markers, color-coded by type
- [x] Frontend: info windows with photo, title, location, specs, rent, and details link
- [x] Frontend: side panel list view with property cards, click-to-zoom on map
- [x] Frontend: filter bar (city, type, bedrooms, price range) with debounced inputs
- [x] Frontend: added /map route and nav link (desktop + mobile) with MapPin icon
- [x] Admin: lat/lng fields already in property create/edit forms
- [x] Admin: geocoding available via Google Maps proxy
- [x] Wrote 24 map tests (filters, coordinates, markers, performance, info windows)
- [x] All 428 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## Marker Clustering (Feb 16)
- [x] Install @googlemaps/markerclusterer v2.6.2
- [x] Integrate clustering with SuperClusterAlgorithm (radius: 80, maxZoom: 16)
- [x] Custom cluster renderer: color-coded by count (teal <10, gold <50, orange <100, red 100+)
- [x] Cluster circles scale by count (40-70px), hover animation, proper z-index
- [x] Cleanup on re-render: clearMarkers + setMap(null) before recreating
- [x] All 428 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## Hero Video Background (Feb 16)
- [x] Upload monthlykey.mp4 to S3 CDN (11.7MB)
- [x] Extract poster frame at 3s mark and upload to CDN as fallback
- [x] Replace hero section background with looping muted autoplay video
- [x] Add light gradient overlay (from-black/40 via-black/20 to-black/50) for text readability
- [x] Poster image fallback behind video (shows while video loads)
- [x] Separate overlay logic for video/image/pattern hero modes
- [x] Auto .play() call on loadedData for browser compatibility
- [x] All 428 tests passing, 0 TypeScript errors
- [x] Save checkpoint, push to GitHub

## Hero Search Bar (Feb 16)
- [x] Add search input with glass-card styling to hero section
- [x] Add city dropdown filter and property type filter
- [x] Add autocomplete suggestions (cities, property types) with 2-char minimum
- [x] Navigate to /search page with query params (q, city, type) on submit
- [x] Quick filter buttons for top 4 cities (Riyadh, Jeddah, Madinah, Dammam)
- [x] Mobile-responsive layout (stacked on mobile, inline on desktop)
- [x] Search page reads URL params on load (q → text search, city → city filter, type → property type)
- [x] Text search input added to Search page sidebar with debounced queries
- [x] Active filter badges show search text with clear button
- [x] 21 new hero search tests (URL params, autocomplete logic, quick filters)
- [x] All 449 tests passing, 0 TypeScript errors
- [ ] Save checkpoint, push to GitHub
