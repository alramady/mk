# Bookings & Occupancy
> Last updated: 2026-02-27

This article explains how bookings are managed in the "Monthly Key" platform and how occupancy is calculated.

## Booking Sources

Bookings on the Monthly Key platform can originate from two sources:

| Source | Description |
| --- | --- |
| **Beds24** | Bookings created through the Beds24 channel manager. |
| **LOCAL** | Bookings created directly on the Monthly Key platform by staff. |

### Source-of-Truth Rules

To avoid conflicts and ensure data integrity, it is crucial to understand the source-of-truth rules for bookings:

*   **For units mapped to Beds24:** Beds24 is the **single source of truth**. All bookings, modifications, and cancellations for these units *must* be managed through the Beds24 platform. The Monthly Key system will reflect these changes, but it will not allow direct modifications to the booking itself.
*   **For units not mapped to Beds24:** The Monthly Key platform is the source of truth. Bookings for these units are managed directly within our system.

> **Important:** Never attempt to directly modify a booking in the Monthly Key platform if the unit is managed by Beds24. This can lead to data inconsistencies and booking conflicts.

### The "UNKNOWN" State

A booking can sometimes appear in an **UNKNOWN** state. This typically occurs when there is a delay or interruption in receiving data from Beds24.

If you encounter a booking in the UNKNOWN state, please follow these steps:
1.  Wait for a few minutes to see if the system updates automatically.
2.  If the state persists, check the booking status directly in the Beds24 platform.
3.  If there is a discrepancy, notify an **admin** immediately to investigate the issue. Do not attempt to manually alter the booking.

## Occupancy Calculation

Occupancy is a key performance indicator (KPI) for our business. It is calculated as follows:

```
Occupancy % = (Number of Occupied Nights / Number of Available Nights) * 100
```

*   **Occupied Nights:** The total number of nights that units are booked and paid for within a given period.
*   **Available Nights:** The total number of nights that units are available for booking (i.e., not `BLOCKED` or under `MAINTENANCE`).

The occupancy rate is a primary metric for `ops` and `admin` roles to monitor the performance of our properties.

## FAQ

**1. What should I do if a customer with a Beds24 booking wants to extend their stay?**

For units controlled by Beds24, any extension or renewal requires **admin** approval. The admin will need to make the necessary changes in Beds24 and add a note to the booking in the Monthly Key platform to reflect the change. The system will not write any changes back to Beds24.

**2. Can I manually mark a payment as PAID?**

No. The ledger system is designed to automatically update payment statuses based on webhooks from Moyasar. A payment will transition from `DUE` to `PENDING` and then to `PAID` or `FAILED`. If you suspect an issue with a payment, contact the `finance` team.

**3. What's the difference between a `BLOCKED` and a `MAINTENANCE` unit status?**

*   `BLOCKED`: The unit is temporarily unavailable for booking for reasons other than maintenance (e.g., owner's use, pending long-term lease).
*   `MAINTENANCE`: The unit is unavailable due to scheduled repairs or upkeep.

---

### Related Articles

*   [../en/02-buildings-units.md](../en/02-buildings-units.md)
*   [../en/03-payments-ledger.md](../en/03-payments-ledger.md)
*   [../en/05-renewals-extensions.md](../en/05-renewals-extensions.md)
