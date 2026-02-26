> Last updated: 2026-02-27

# Notifications & Email

This article provides an overview of the automated notifications and email settings within the Monthly Key platform. Understanding these is crucial for ensuring smooth communication with guests and effective internal operations.

## Notification Triggers and Types

The platform sends various notifications based on specific events. These are delivered to both guests and internal staff members depending on the notification's purpose.

| Notification Type | Trigger | Recipient(s) | Channel(s) |
| :--- | :--- | :--- | :--- |
| **Booking Confirmation** | A new booking is successfully created (either via Beds24 or locally). | Guest, Support | Email |
| **Payment Receipt** | A payment is successfully processed via Moyasar (Mada, Apple Pay, Google Pay). | Guest, Finance | Email |
| **Payment Failure** | A payment attempt fails. | Guest, Finance | Email |
| **Renewal Reminder** | 7 days before a 1-month booking is due to expire. | Guest, Support | Email |
| **Maintenance Update** | A unit's status is changed to/from MAINTENANCE. | Ops | Internal System Notification |
| **Beds24 Sync Error** | The system fails to sync data with Beds24 for a mapped unit. | Admin | Email |

### Booking Confirmation

When a booking is confirmed, the guest receives an email with their booking details, including the unit, dates, and total price. The support team is also notified to be aware of the new arrival.

### Payment Notifications

Payment notifications are directly tied to the Moyasar payment gateway. 

- A **Payment Receipt** is sent automatically once a payment is successfully captured. This email includes the amount paid and the updated booking balance.
- A **Payment Failure** notification is sent if a payment cannot be processed. The finance team is alerted to follow up with the guest if necessary.

### Renewal Reminders

For monthly bookings eligible for a single renewal, an automated reminder is sent to the guest one week before their stay ends. This prompts them to contact support if they wish to extend their stay. For units managed by Beds24, any extension requires manual approval from an admin.

### Internal Notifications

- **Maintenance Updates**: The operations team receives an in-system notification when a unit is marked for maintenance, allowing them to schedule work accordingly. They are also notified when the unit is made available again.
- **Beds24 Sync Errors**: If there is an issue communicating with Beds24, an email is sent to the admin to investigate and resolve the problem to prevent booking conflicts.

## Email Settings

Currently, the content and branding of the automated emails are standardized and cannot be modified by staff. All emails are sent from a central address (`noreply@monthlykey.com`).

For any required changes to email templates or sender information, a request must be submitted to the technical team.

## FAQ

**1. Can I manually send a payment receipt to a guest?**

No, payment receipts are triggered automatically by successful payments in Moyasar. You can, however, confirm the payment status in the ledger and share a screenshot of the paid invoice with the guest if needed.

**2. What happens if a guest doesn't receive their booking confirmation?**

First, ask the guest to check their spam or junk folder. If they still can't find it, verify their email address in the system. If the email is correct, you can resend the confirmation from the booking details page (Admin and Support roles only).

**3. Who approves renewal requests for Beds24-managed units?**

All renewals for units linked to Beds24 must be approved by an Admin. This is to ensure that the extension does not conflict with any external bookings made via other channels.

**4. Can we customize the renewal reminder email?**

No, the email templates are standardized. Any suggestions for changes should be passed on to the management team for consideration in future updates.

## Related Articles

- [01-roles-permissions.md](../en/01-roles-permissions.md)
- [03-payments-ledger.md](../en/03-payments-ledger.md)
- [04-bookings-renewals.md](../en/04-bookings-renewals.md)
- [02-buildings-units.md](../en/02-buildings-units.md)
