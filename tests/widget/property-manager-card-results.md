# Smoke Test Results — Property Manager Card

**Test File:** `tests/widget/property-manager-card.test.tsx`
**Date:** 2026-03-07
**Runner:** Vitest v2.1.9
**Environment:** jsdom
**Duration:** 1.67s (transform 154ms, setup 92ms, collect 326ms, tests 181ms, environment 774ms, prepare 75ms)

## Summary

| Metric | Value |
|--------|-------|
| Test Files | 1 passed (1) |
| Tests | **36 passed (36)** |
| Failures | 0 |

## Test Results

### 1. Manager Card Renders When Data Present
- ✓ renders the manager card container
- ✓ displays manager name in Arabic
- ✓ displays manager name in English
- ✓ displays manager title in Arabic
- ✓ displays manager title in English

### 2. Contact Links
- ✓ renders phone link with correct href
- ✓ renders phone number text
- ✓ renders WhatsApp link with correct href
- ✓ renders WhatsApp text in Arabic
- ✓ renders WhatsApp text in English
- ✓ does not render phone link when phone is null
- ✓ does not render WhatsApp link when whatsapp is null

### 3. View Profile Link
- ✓ renders profile link with correct href
- ✓ displays Arabic text for profile link
- ✓ displays English text for profile link

### 4. Manager Card Hidden When No Data
- ✓ does not render when manager is null
- ✓ does not render when manager is undefined

### 5. Avatar & Photo
- ✓ renders photo when photoUrl is present
- ✓ hides fallback avatar when photo is present
- ✓ shows fallback avatar initials when photoUrl is null
- ✓ does not render photo img when photoUrl is null
- ✓ shows PM as fallback when name is empty

### 6. Sidebar Scrollability
- ✓ sidebar inner container has overflow-y-auto class
- ✓ sidebar inner container has max-height class
- ✓ sidebar inner container has sticky positioning
- ✓ manager card is a child of the scrollable sidebar

### 7. API Response Shape
- ✓ MOCK_PROPERTY_WITH_MANAGER has manager object
- ✓ manager object has all required fields
- ✓ MOCK_PROPERTY_NO_MANAGER has null manager
- ✓ manager condition (prop as any).manager is truthy for assigned property
- ✓ manager condition (prop as any).manager is falsy for unassigned property

### 8. Edge Cases
- ✓ handles manager with only name (no phone, no whatsapp, no photo)
- ✓ handles manager with Arabic name fallback to English
- ✓ handles manager with Arabic title fallback
- ✓ handles manager with English title fallback
- ✓ WhatsApp href strips non-numeric characters
