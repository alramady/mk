# Launch Readiness Tasks — Status Report

**Date:** 2026-02-27

---

## E1: Logo Size Increase

**Status:** ✅ Already Implemented

The logo in the Navbar component already uses responsive sizing with progressive scaling across breakpoints.

**Current implementation** (`client/src/components/Navbar.tsx`, line 263):

```tsx
className="h-10 sm:h-12 md:h-14 w-auto object-contain"
```

This translates to:
- **Mobile:** 40px height (`h-10`)
- **Small screens (640px+):** 48px height (`h-12`)
- **Medium screens (768px+):** 56px height (`h-14`)

The navbar container height is also responsive (`h-16 sm:h-20`), providing adequate space for the logo at all sizes.

**Recommendation:** If a larger logo is desired, increase to `h-12 sm:h-14 md:h-16` (48px → 56px → 64px). This is a single-line CSS change:

```diff
- className="h-10 sm:h-12 md:h-14 w-auto object-contain"
+ className="h-12 sm:h-14 md:h-16 w-auto object-contain"
```

**Decision needed:** Does the current size meet requirements, or should the increase be applied?

---

## E2: Terms of Use

**Status:** ✅ Already Implemented

### Terms of Service Page

A comprehensive Terms of Service page exists at `client/src/pages/TermsOfService.tsx` (357 lines) with:

- Full Arabic legal content covering 15 sections:
  1. التعريفات (Definitions)
  2. طبيعة الخدمة (Nature of Service)
  3. التسجيل والحساب (Registration & Account)
  4. الحجز والإيجار (Booking & Rental)
  5. المدفوعات والرسوم (Payments & Fees)
  6. الإلغاء والاسترداد (Cancellation & Refund)
  7. التزامات المستأجر (Tenant Obligations)
  8. التزامات المؤجر (Landlord Obligations)
  9. المسؤولية (Liability)
  10. الخصوصية وحماية البيانات (Privacy & Data Protection)
  11. الملكية الفكرية (Intellectual Property)
  12. إنهاء الخدمة (Service Termination)
  13. القانون المعمول به (Applicable Law)
  14. التعديلات (Amendments)
  15. التواصل (Contact)
- Full English translation of all sections
- Language toggle (follows site language)
- Responsive layout with Navbar and Footer
- Route: `/terms`
- Footer link to Terms page

### Admin CMS for Terms

The Admin Settings page (`client/src/pages/AdminSettings.tsx`) includes a "Terms & Privacy Content" section where administrators can edit the terms content in both Arabic and English via `platformSettings` keys:
- `terms.contentAr` — Arabic terms content
- `terms.contentEn` — English terms content

### Terms Acceptance at Registration

**Gap identified:** The Register page (`client/src/pages/Register.tsx`) does not currently include a terms acceptance checkbox. There is no `termsAcceptedAt` column in the `users` table.

**Recommendation for future sprint:**
1. Add `termsAcceptedAt DATETIME` column to `users` table
2. Add checkbox to Register page: "أوافق على الشروط والأحكام / I agree to the Terms of Service"
3. Block registration if checkbox is unchecked
4. Record timestamp in `termsAcceptedAt` on registration

This is a non-blocking item for launch since the Terms page is publicly accessible and linked from the footer.

---

## E3: Payment Method Badges

**Status:** ✅ Fully Implemented

### Component

`PaymentMethodsBadges` component (`client/src/components/PaymentMethodsBadges.tsx`) dynamically renders payment method badges based on admin-configured settings.

### Placement

| Location | Implementation | Line |
|----------|---------------|------|
| Footer | `<PaymentMethodsBadges variant="footer" />` | `Footer.tsx:164` |
| Property Detail | `<PaymentMethodsBadges variant="inline" />` | `PropertyDetail.tsx` |

### Supported Payment Methods

| Method | Badge | Admin Toggle |
|--------|-------|-------------|
| mada | SVG badge with official branding | `paymentMethods.madaCard` |
| Apple Pay | SVG badge with official branding | `paymentMethods.applePay` |
| Google Pay | SVG badge with official branding | `paymentMethods.googlePay` |
| Tabby | SVG badge (future) | `paymentMethods.tabby` |
| Tamara | SVG badge (future) | `paymentMethods.tamara` |
| Bank Transfer | Icon badge | `paymentMethods.bankTransfer` |
| Cash | Icon badge | `paymentMethods.cash` |

### Admin Configuration

Payment methods are toggled on/off in Admin Settings → Payment Methods section. Only enabled methods appear in the badges component. The component fetches enabled methods via the `getEnabledPaymentMethodsForBadges` API endpoint.

### Test Coverage

58 dedicated tests covering:
- Correct badge rendering for each payment method
- Dynamic show/hide based on admin settings
- Footer variant styling
- Inline variant styling
- Empty state (no methods enabled)
- Accessibility attributes

---

## Summary

| Task | Status | Action Required |
|------|--------|----------------|
| E1: Logo Size | ✅ Done | Optional: increase if desired |
| E2: Terms of Use | ✅ Done (page + CMS) | Future: add registration checkbox |
| E3: Payment Badges | ✅ Done | None |
