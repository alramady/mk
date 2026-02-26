> Last updated: 2026-02-27

# Roles & Permissions

This article provides a detailed overview of the different user roles within the Monthly Key system and the specific permissions associated with each role. Understanding these roles is crucial for ensuring that each team member has the appropriate level of access to perform their duties effectively while maintaining the security and integrity of our data.

## System Roles

The Monthly Key system has four distinct roles, each with a specific set of permissions tailored to their responsibilities:

*   **Admin:** The administrator role has unrestricted access to all modules and settings in the system. This role is typically reserved for a few key individuals responsible for the overall management and configuration of the platform.
*   **Ops (Operations):** The operations role is responsible for the day-to-day management of properties, including buildings, units, and bookings. They ensure that the physical assets are well-maintained and that the booking process runs smoothly.
*   **Finance:** The finance role manages all financial aspects of the platform, including payments, ledgers, and financial reporting. They are responsible for tracking revenue and ensuring the accuracy of financial records.
*   **Support:** The support role is the first point of contact for our customers. They handle customer inquiries, provide assistance with bookings and payments, and manage customer communication.

## Permissions Matrix

The following table provides a detailed breakdown of the permissions for each role across the various modules of the Monthly Key system.

| Feature/Module | Admin | Ops | Finance | Support |
| --- | :---: | :---: | :---: | :---: |
| **Buildings & Units** | | | | |
| Create/Edit/Archive Buildings | ✅ | ✅ | ❌ | ❌ |
| Create/Edit/Archive Units | ✅ | ✅ | ❌ | ❌ |
| Set Unit Status (Available/Blocked/Maintenance) | ✅ | ✅ | ❌ | ✅ |
| Link Units to Beds24 | ✅ | ❌ | ❌ | ❌ |
| **Payments (Moyasar)** | | | | |
| View Payment Records | ✅ | ✅ | ✅ | ✅ |
| View Ledger (DUE→PENDING→PAID/FAILED) | ✅ | ✅ | ✅ | ✅ |
| Manually Trigger Webhook Finalization | ✅ | ❌ | ✅ | ❌ |
| Access Moyasar Dashboard | ✅ | ❌ | ✅ | ❌ |
| **Bookings** | | | | |
| View All Bookings | ✅ | ✅ | ✅ | ✅ |
| View Bookings for Assigned Properties | ✅ | ✅ | ✅ | ✅ |
| Manually Create Local Bookings | ✅ | ✅ | ❌ | ✅ |
| View Booking Source (Beds24/Local/Unknown) | ✅ | ✅ | ✅ | ✅ |
| **Renewals** | | | | |
| Approve Renewals for Beds24-Controlled Units | ✅ | ❌ | ❌ | ❌ |
| Add Change Notes to Renewals | ✅ | ✅ | ❌ | ✅ |
| View Renewal History | ✅ | ✅ | ✅ | ✅ |
| **KPIs & Reporting** | | | | |
| View Occupancy % | ✅ | ✅ | ✅ | ❌ |
| View PAR (Price per Available Room) | ✅ | ✅ | ✅ | ❌ |
| View Collected YTD | ✅ | ❌ | ✅ | ❌ |
| View EAR (Effective Annual Rate) | ✅ | ❌ | ✅ | ❌ |
| View RevPAU (Revenue per Available Unit) | ✅ | ❌ | ✅ | ❌ |
| **Notifications** | | | | |
| Configure Notification Templates | ✅ | ❌ | ❌ | ❌ |
| Manually Send Notifications | ✅ | ✅ | ✅ | ✅ |
| View Notification Logs | ✅ | ✅ | ✅ | ✅ |
| **Security** | | | | |
| Manage User Accounts | ✅ | ❌ | ❌ | ❌ |
| View API Keys | ✅ | ❌ | ❌ | ❌ |
| Access Beds24 Credentials | ✅ | ❌ | ❌ | ❌ |

**Key:**
*   ✅: Full Access
*   ❌: No Access

## FAQ

**1. What should I do if I need access to a feature that is not available for my role?**

If you require access to a feature that is currently restricted for your role, you should contact your line manager to discuss your requirements. If approved, a system administrator can grant you the necessary permissions.

**2. Can I have more than one role?**

In general, each user is assigned a single role that best fits their responsibilities. In exceptional cases, a user may be assigned more than one role, but this requires approval from management.

**3. Why can't I manually mark a payment as PAID?**

For security and accuracy, the system is designed to update payment statuses automatically via webhooks from our payment provider, Moyasar. This ensures that the ledger always reflects the true state of the payment and prevents manual errors.

**4. What is the difference between a Beds24 booking and a LOCAL booking?**

A Beds24 booking is a reservation that originates from one of our connected online travel agencies (OTAs) via the Beds24 channel manager. A LOCAL booking is a reservation that is created directly in the Monthly Key system by a member of our team.

**5. Who should I contact if I notice a discrepancy in the financial data?**

If you believe there is a discrepancy in any of the financial data, you should immediately report it to the finance team. They will investigate the issue and take the necessary steps to correct it.

## Related Topics

*   [../en/02-buildings-units.md](../en/02-buildings-units.md)
*   [../en/03-payments-ledger.md](../en/03-payments-ledger.md)
*   [../en/04-bookings-renewals.md](../en/04-bookings-renewals.md)
