# MK Analytics — Metric Definitions
# تعريفات مقاييس التحليلات — المفتاح الشهري

**Version / الإصدار:** 1.0  
**Date / التاريخ:** 2 March 2026  
**Reference Commit:** `9beb60e`

---

## Booking Metrics / مقاييس الحجوزات

| Metric | المقياس | Definition | SQL Filter |
|--------|---------|-----------|------------|
| **Total Bookings** | إجمالي الحجوزات | Count of all bookings created in date range, regardless of status | `COUNT(*) FROM bookings WHERE createdAt IN range` |
| **Pending Approval** | بانتظار الموافقة | Bookings awaiting admin/landlord approval | `status = 'pending'` |
| **Approved (Awaiting Payment)** | معتمد (بانتظار الدفع) | Bookings approved but not yet paid | `status = 'approved'` |
| **Active Bookings** | حجوزات نشطة | Bookings where payment is confirmed AND date range overlaps today | `status = 'active' AND moveInDate <= NOW() AND moveOutDate >= NOW()` |
| **Completed** | مكتمل | Bookings that have finished their stay period | `status = 'completed'` |
| **Cancelled/Rejected** | ملغي/مرفوض | Bookings cancelled or rejected | `status IN ('cancelled', 'rejected')` |

## Revenue Metrics / مقاييس الإيرادات

| Metric | المقياس | Definition | SQL Filter |
|--------|---------|-----------|------------|
| **Realized Revenue** | الإيرادات المحققة | Sum from payments/ledger where payment is confirmed settled | `SUM(amount) FROM payments WHERE status IN ('completed', 'paid')` |
| **Booked Revenue** | الإيرادات المحجوزة | Sum of grandTotal for confirmed+active bookings (even if not yet paid) | `SUM(totalAmount) FROM bookings WHERE status IN ('approved', 'active')` |
| **Monthly Revenue** | الإيرادات الشهرية | Realized revenue grouped by month | Same as Realized, grouped by `DATE_FORMAT(createdAt, '%Y-%m')` |

**Important:** Revenue query now includes both `completed` (manual admin override) and `paid` (Moyasar webhook) statuses. Previously only `completed` was counted, which missed all Moyasar-confirmed payments.

## Occupancy Metrics / مقاييس الإشغال

| Metric | المقياس | Definition | Calculation |
|--------|---------|-----------|-------------|
| **Occupancy Rate** | نسبة الإشغال | Percentage of available property-days that are booked | `(bookedDays / availableDays) * 100` |
| **Available Days** | الأيام المتاحة | Total days across all published properties, excluding maintenance blocks | `SUM(daysInPeriod) for published properties - maintenance blocks` |
| **Booked Days** | الأيام المحجوزة | Days covered by active/confirmed bookings in availability_blocks | `SUM(DATEDIFF(endDate, startDate)) FROM availability_blocks WHERE blockType = 'BOOKING'` |

## Availability Blocks / كتل التوافر

The `availability_blocks` table is the **source of truth** for occupancy calculations.

| Block Type | Created When | Removed When |
|-----------|-------------|-------------|
| `BOOKING` | Booking transitions to `active` (payment confirmed) | Booking cancelled/refunded |
| `MAINTENANCE` | Admin marks property as under maintenance | Admin clears maintenance |
| `BEDS24_IMPORT` | Beds24 sync imports external booking | Beds24 sync reports cancellation |

**Backfill endpoint:** `POST /api/admin/backfill-availability` creates availability_blocks for all existing active/completed bookings that don't already have blocks.

## Status Lifecycle / دورة حياة الحالات

```
Booking:  pending → approved → active (payment confirmed) → completed (checkout)
                  → rejected (admin rejects)
                  → cancelled (at any point)

Payment:  pending → completed (manual override)
                  → paid (Moyasar webhook)
                  → failed/refunded
```

| Status | الحالة | Counts in Revenue? | Counts in Occupancy? |
|--------|--------|-------------------|---------------------|
| pending | قيد الانتظار | No | No |
| approved | معتمد | No | No |
| active | نشط | Yes (at payment time) | Yes |
| completed | مكتمل | Yes | Yes |
| rejected | مرفوض | No | No |
| cancelled | ملغي | No | No |

## Payment Statuses (Moyasar) / حالات الدفع

| Status | Source | Counts in Revenue? |
|--------|--------|-------------------|
| `paid` | Moyasar gateway (automatic) | **Yes** |
| `completed` | Manual admin override | **Yes** |
| `pending` | Awaiting payment | No |
| `failed` | Payment failed | No |
| `refunded` | Payment refunded | No |

---

**Prepared by:** Manus AI  
**Last updated:** 2 March 2026
