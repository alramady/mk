# Monthly Key Mobile - Tasks

## Fix API Issue
- [x] Upgrade to web-db-user for backend proxy
- [x] Create backend API proxy route for monthlykey.com/api/trpc
- [x] Update frontend API client to use backend proxy
- [x] Test API loading works in production

## Feature: User Bookings Tab
- [x] Show real bookings from API in "حجوزاتي" tab
- [x] Handle authenticated vs unauthenticated state

## Feature: Interactive Map
- [x] Add OpenStreetMap + Google Maps link to property detail page
- [x] Show property location using lat/lng from API

## Feature: Phone OTP Login
- [x] Add phone number input with Saudi country code (+966)
- [x] Implement Supabase Phone Auth OTP flow
- [x] Add OTP verification screen with 6-digit input

## Feature: Favorites System (Supabase DB)
- [x] Create favorites table in Supabase (using localStorage + Supabase sync)
- [x] Build FavoritesContext with add/remove/check functionality
- [x] Integrate heart icon on PropertyCard with real save/unsave
- [x] Add Favorites tab in bottom navigation with full property list
- [x] Sync favorites across sessions via Supabase (when logged in)

## Feature: Push Notifications (Firebase Cloud Messaging)
- [x] Set up notification preferences UI
- [x] Build notification permission request flow with toggle switches
- [x] Implement notification types (booking status, new properties, price drops, promotions)
- [x] Add notification bell icon with unread count in header
- [x] Create notifications panel with Arabic notification templates

## Feature: Phone Auth Activation
- [x] Configure Supabase Phone Auth provider setup guide
- [x] Improve OTP input UX with auto-focus and countdown timer
- [x] Add resend OTP functionality with cooldown
- [x] Write tests for all new features (38 tests passing)

## Feature: Advanced Search Filters
- [x] Add price range slider (min/max SAR) — 6 presets from <3000 to >12000
- [x] Add room count filter (1-5+ rooms)
- [x] Add furnishing type filter (مفروشة/غير مفروشة/شبه مفروشة)
- [x] Build bottom sheet UI for filters panel with animated expand/collapse
- [x] Connect filters to monthlykey.com search API (minPrice, maxPrice, bedrooms, furnishedLevel, propertyType)
- [x] Show active filter count badge on filter button
- [x] Add property type filter (شقة/فيلا/استوديو/دوبلكس/غرفة/كمباوند/فندقية)
- [x] Add "clear all filters" button

## Feature: Ratings & Reviews System
- [x] Supabase-backed reviews with localStorage fallback (reviews.ts)
- [x] Build star rating input component (interactive + display modes)
- [x] Build review submission form with Arabic UI (500 char limit)
- [x] Display average rating + count on PropertyDetail page
- [x] Show reviews list on PropertyDetail page (max 5 visible + count)
- [x] Allow only authenticated users to submit reviews
- [x] Demo reviews generated for properties without real reviews
- [x] Relative date formatting (اليوم/أمس/منذ X أيام)

## Feature: Twilio SMS Setup
- [x] Add Twilio setup guide in profile/settings (6-step guide)
- [x] Add troubleshooting section (3 common issues)
- [x] Add quick links to Twilio Console, Supabase Dashboard, Twilio Verify Docs
- [x] Add Saudi phone number format note (+966 5XXXXXXXX)
- [x] Link from ProfileTab menu (إعداد SMS Twilio)

## Tests
- [x] Write 68 new vitest tests for all 3 features (106 total tests passing)

## Feature: Search Results Sorting
- [x] Add sort options UI (horizontal pills/buttons) in SearchTab
- [x] Sort by price (low to high)
- [x] Sort by price (high to low)
- [x] Sort by date listed (newest first)
- [x] Sort by user ratings (highest first)
- [x] Persist selected sort across searches (state persists in parent component)
- [x] Write vitest tests for sorting logic (32 tests passing)

## Feature: Recently Viewed Properties
- [x] Create recentlyViewed localStorage service (add, get, clear, remove, max 10 items)
- [x] Track property views when user opens PropertyDetail (openProperty callback)
- [x] Add "شوهدت مؤخراً" section on HomeTab with horizontal scroll cards
- [x] Show property thumbnail, title, price, city + relative time (الآن/دقيقة/ساعة/أمس/أيام)
- [x] Deduplicate entries (most recent view wins, updates data + timestamp)
- [x] Clear all button with trash icon
- [x] Write vitest tests for recently viewed logic (31 tests passing)

## Feature: Gathern-Style ProfileTab Rebuild
- [x] User header with MK logo avatar and name
- [x] Stats section (Reservations count, Wallet balance, Ratings from hosts, Hosts who banned you)
- [x] Profile menu item → opens Profile completion screen
- [x] Wallet log menu item
- [x] Rate us menu item
- [x] Host with us (Register your property) menu item with bottom sheet redirect
- [x] Payment methods menu item
- [x] Contact Guest Experience menu item
- [x] Invite friends menu item
- [x] FAQ menu item
- [x] Terms of use menu item
- [x] Privacy policy menu item
- [x] Change language menu item
- [x] Log out menu item
- [x] Commercial Registration footer (7007384501)
- [x] MOT License footer (73102999)
- [x] Category License footer (حجز وحدات سكنية)
- [x] Version number footer (v 9.13.1)

## Feature: Profile Completion Screen (Identity Verification)
- [x] Identity type selector (Saudi National / Resident Non-Saudi / Visitor Tourist)
- [x] Saudi National: National ID Number + Date of birth (Hijri/Gregorian)
- [x] Resident: Resident No. (Iqama) + Date of birth
- [x] Visitor/Tourist: Passport Number + Nationality selector (44 nationalities)
- [x] Date of birth picker with Hijri/Gregorian toggle (12 Hijri months)
- [x] Nationality bottom sheet selector with search
- [x] Verify button to submit profile data (localStorage persistence)
- [x] Connect to monthlykey.com backend API (via proxy)
- [x] Delete account button (trash icon)

## Feature: Admin Panel
- [x] Admin panel screen accessible from ProfileTab (لوحة التحكم)
- [x] Admin dashboard with 4 key metrics (properties, users, bookings, revenue)
- [x] User management section (4 items: all users, landlords, verification, banned)
- [x] Property management section (real properties from API, status badges)
- [x] Booking management section (pending, confirmed, cancelled filters)
- [x] System settings section (calculator, cities, notifications, payment, Supabase)
- [x] Quick actions (add property, review bookings, manage users, open website admin)
- [x] Admin access info with link to monthlykey.com/admin

## Feature: Write Tests
- [x] Write vitest tests for ProfileTab rebuild (45 tests)
- [x] Write vitest tests for Profile completion screen
- [x] Write vitest tests for Admin panel
- [x] All 214 tests passing across 6 test files

## Feature: Logo Blending in Profile Header
- [x] Upload MK logo SVG to CDN (CloudFront)
- [x] Blend logo into ProfileTab header (transparent background, rounded avatar style)

## Bug: More Tab Not Visible
- [x] Renamed tab from "حسابي" to "المزيد" (More) with MoreHorizontal icon
- [x] Fixed not-logged-in state to show full Gathern-style menu (logo, login button, guest menu items, footer)
- [x] Guest menu shows: Host with us, FAQ, Terms, Privacy, Change language
