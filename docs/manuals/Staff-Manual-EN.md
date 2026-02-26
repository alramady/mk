# Staff Manual: Monthly Key

## 1. Introduction & Platform Overview

Welcome to the official staff manual for **Monthly Key** (المفتاح الشهري), a premier monthly rental platform based in the Kingdom of Saudi Arabia. This document serves as a comprehensive guide for all internal team members, providing the knowledge and tools necessary to effectively manage our platform, support our customers, and ensure smooth day-to-day operations.

Monthly Key is designed to cater to the growing demand for flexible, hassle-free monthly accommodation. Our target audience includes:

- **Business Travelers & Expatriates:** Professionals seeking temporary housing for corporate assignments or relocation.
- **Tourists & Visitors:** Individuals and families looking for extended stays to explore the Kingdom.
- **Students:** University students in need of off-campus housing for a semester or academic year.

Our key value proposition is to offer a seamless and modern rental experience, combining the convenience of online booking with the comfort of a fully furnished, ready-to-live-in property. We eliminate the complexities of traditional annual leases, providing our tenants with flexibility, transparency, and exceptional service.


## 2. Getting Started

This section will guide you through the initial steps of accessing and navigating the Monthly Key admin dashboard.

### Logging In

Access to the admin panel is restricted to authorized personnel. You will be provided with a unique username and password. To log in, navigate to [admin.monthlykey.com](https://admin.monthlykey.com) and enter your credentials.

### Admin Dashboard Overview

The dashboard is your central hub for managing all aspects of the platform. Upon logging in, you will see a comprehensive overview of key performance indicators (KPIs), recent bookings, and pending tasks. The main dashboard provides a snapshot of your portfolio's health and performance.

[Screenshot placeholder: Admin Dashboard Overview]

### The Sidebar Menu

The sidebar menu on the left provides access to all the core modules of the platform. Key sections include:

- **Dashboard:** Returns you to the main overview page.
- **Buildings:** Manage all properties, including creating, editing, and archiving buildings and their associated units.
- **Payments:** View and manage all financial transactions, including the payment ledger and registry.
- **Bookings:** Track all current, past, and future bookings.
- **Reports:** Access detailed reports and analytics on occupancy, revenue, and other KPIs.
- **Content:** Manage the content of the public-facing website, including property listings, images, and FAQs.
- **Settings:** Configure platform-wide settings, including payment methods and user accounts.


## 3. Managing Buildings & Units

This module is the heart of our inventory management. Here, you will learn how to create, update, and maintain our portfolio of properties.

[Screenshot placeholder: Buildings List Page]

### Creating a New Building

1.  Navigate to the **Buildings** section from the sidebar.
2.  Click the **"New Building"** button.
3.  Fill in the required details: Building Name, Address, and any relevant notes.
4.  Click **"Save"**. The new building will now appear in your building list.

### Adding Units to a Building

1.  From the building list, click on the building you wish to add units to.
2.  Select the **"Units"** tab.
3.  Click the **"Add Unit"** button.
4.  Enter the unit details: Unit Number, Floor, Rent Amount, and current status (e.g., Available, Occupied, Under Maintenance).
5.  Click **"Save"**. Repeat this process for all units within the building.

### Editing Unit Details

To update information for an existing unit:

1.  Navigate to the desired building and select the **"Units"** tab.
2.  Find the unit you wish to edit and click the **"Edit"** icon.
3.  Modify the status, rent, floor, or any other relevant fields.
4.  Click **"Save"** to apply the changes.

### Archiving a Building or Unit

Archiving is a soft-delete function that hides a building or unit from the active list while preserving its data for historical purposes.

1.  To archive a building, find it in the main list and click the **"Archive"** icon.
2.  To archive a unit, navigate to the building's unit list and click the **"Archive"** icon next to the specific unit.

> **Best Practice:** Only archive buildings or units that are permanently no longer part of our portfolio. For temporary unavailabilities, use the "Under Maintenance" or "Blocked" status instead.

### Beds24 Mapping

Beds24 is a third-party channel manager that we use to synchronize our inventory with various booking platforms. Mapping a unit to Beds24 links it to a corresponding room in their system.

-   **To Link a Unit:** In the unit's edit screen, you will find a "Beds24 Mapping" field. Enter the Beds24 room ID to create the link.
-   **To Unlink a Unit:** Simply clear the Beds24 room ID from the mapping field and save.

**Warning: A unit's availability and pricing become controlled by Beds24 once it is mapped. The local Monthly Key system becomes a read-only mirror for that unit's core booking data.**


## 4. Payment Management

This section covers the critical aspects of managing payments through our integration with the Moyasar payment gateway.

### How Moyasar Payments Work

We use Moyasar to process all online payments. Supported methods include:

-   **Mada:** The most common payment network in Saudi Arabia.
-   **Credit Cards:** Visa and Mastercard.
-   **Apple Pay & Google Pay:** For seamless mobile payments.

When a customer initiates a payment, they are redirected to a secure Moyasar page to complete the transaction. Our system then receives a notification of the payment's status.

### Understanding the Payment Ledger

The payment ledger provides a real-time view of the status of each transaction. The lifecycle of a payment is as follows:

1.  **DUE:** A payment has been generated for a booking but has not yet been paid.
2.  **PENDING:** The customer has initiated the payment process, but we are awaiting final confirmation from Moyasar.
3.  **PAID:** The payment was successful, and the funds have been secured.
4.  **FAILED:** The payment attempt was unsuccessful.

**CRITICAL: Payments are finalized ONLY via webhook. A webhook is an automated notification sent from Moyasar's servers to ours. Never manually mark a payment as PAID, as this can lead to serious reconciliation issues. The system will automatically update the status upon receiving the webhook.**

### Viewing the Payments Registry

The Payments Registry is a comprehensive log of all transactions.

[Screenshot placeholder: Payments Registry]

You can use the registry to:

-   **Search:** Find specific transactions by customer name, unit, or transaction ID.
-   **Filter:** Narrow down the list by date, status, or payment method.
-   **Export:** Download a CSV file of the transaction data for reporting or analysis.

### Handling Refunds and Adjustments

Refunds must be processed directly through the Moyasar dashboard. Our platform does not have a built-in refund function to prevent accidental or unauthorized refunds. Adjustments to a booking's cost must be made *before* the payment is initiated.

> **Best Practice:** When a refund is requested, always verify the original transaction in both our system and the Moyasar portal. Document the reason for the refund in the booking notes.

### Configuring Payment Methods

Payment methods can be enabled or disabled in the **Admin Settings > Payments** section. This allows us to control which payment options are available to customers at checkout.

## 5. Bookings & Occupancy

This section explains how to manage bookings and understand occupancy data, which is crucial for maximizing revenue.

### Booking Sources

Bookings can originate from two sources:

-   **Beds24:** These are bookings that come from external channels (like Booking.com, Airbnb, etc.) and are managed through the Beds24 channel manager.
-   **Local:** These are direct bookings made on the Monthly Key website.

### Source-of-Truth Rules

For units that are mapped to Beds24, **Beds24 is the absolute source of truth** for all availability, pricing, and booking information. Our local system will sync with Beds24, but any discrepancies must be resolved in Beds24's system.

**Warning: Never attempt to manually create a local booking for a Beds24-mapped unit during a period that appears free in our system. The availability shown locally may not be up-to-date. Always verify in Beds24 first.**

### Understanding UNKNOWN Occupancy State

An **UNKNOWN** occupancy state for a unit means that the system cannot definitively determine if the unit is occupied. This usually occurs if there is a data sync issue with Beds24 or if a booking was not correctly finalized. Investigate any UNKNOWN states immediately to ensure data integrity.

### Reading Occupancy Dashboards

The building overview and main dashboard provide several KPIs to help you monitor occupancy.

[Screenshot placeholder: Building Overview with KPIs]

These dashboards give you a visual representation of your portfolio's performance at a glance, allowing you to quickly identify buildings with low occupancy or high vacancy rates.

## 6. Renewals & Extensions

This section outlines the process and rules for handling booking renewals and extensions.

### Eligibility Rules

-   **1-Month Bookings:** Are eligible for one (1) extension of an additional month.
-   **2-Month (or longer) Bookings:** Are not eligible for renewal through the platform. The tenant must create a new booking.

### Approval Workflow for Beds24-Controlled Units

If a tenant in a Beds24-mapped unit requests an extension, the request must be approved by a staff member. This is because the extension must be manually entered into the Beds24 system to avoid double bookings.

[Screenshot placeholder: Extension Approval Dialog]

### Change Note Requirement

When approving or denying an extension, you are required to enter a change note. This creates an audit trail and helps with communication among team members.

**CRITICAL: The Monthly Key system NEVER writes booking information to Beds24. When an extension is approved for a mapped unit, you MUST manually update the booking in the Beds24 extranet to block off the new dates. Failure to do so will result in the unit appearing available on other channels, leading to double bookings.**

> **Best Practice:** As soon as you approve an extension in our system, immediately log into Beds24 and update the booking. Do not leave it for later.

## 7. Customer Support Workflows

This section provides guidance on handling common customer issues.

### Common Issue: "Payment failed"

1.  **Ask for details:** Get the customer's name, the unit they tried to book, and the approximate time of the transaction.
2.  **Check the Payments Registry:** Search for the transaction. If it's marked as FAILED, check the failure reason provided by Moyasar.
3.  **Advise the customer:** Common reasons for failure include insufficient funds, an incorrect card number, or a bank decline. Advise the customer to try a different card or contact their bank.
4.  **Do not try to force the payment:** If the issue persists, escalate to engineering.

### Common Issue: "Cannot see my booking"

1.  **Check the source:** Ask the customer where they made the booking (Monthly Key website vs. another site like Booking.com).
2.  **If Local Booking:** Search for their booking in our system. If it's not there, it likely failed at the payment stage. Guide them through the booking process again.
3.  **If Beds24 Booking:** The booking might not have synced to our system yet. Check the Beds24 extranet directly. If the booking exists in Beds24, it is valid. The sync to our system will happen eventually.

### Common Issue: "Want to extend stay"

1.  **Check eligibility:** Review the renewal and extension rules (Section 6).
2.  **Guide the customer:** If they are eligible, guide them on how to request the extension through their online portal. If not, explain that they will need to make a new booking for the additional period.

### When to Escalate to Engineering

-   System-wide outages or errors.
-   Persistent payment gateway issues not resolved by the customer.
-   Data discrepancies between our system and Beds24 that cannot be explained.
-   Any suspected security vulnerabilities.

### Escalation Contact Matrix

| Issue Type | Primary Contact | Secondary Contact |
|---|---|---|
| Payment Gateway Failure | Engineering Lead | CTO |
| Beds24 Sync Issue | Operations Manager | Engineering Lead |
| Website Content Error | Marketing Manager | N/A |
| Security Incident | **CTO (Immediate)** | CEO |


## 8. Reports & KPIs

Understanding our Key Performance Indicators (KPIs) is essential for measuring success and identifying areas for improvement.

### Reading the Dashboard

The main dashboard displays the most critical KPIs for the entire portfolio.

-   **Occupancy %:** The percentage of available units that are currently occupied.
-   **PAR (Potential Annual Rent):** The total potential rent you could earn in a year if every unit were occupied 100% of the time. `PAR = Sum of all unit rents * 12`
-   **Collected YTD (Year-to-Date):** The total rent collected so far in the current calendar year.
-   **EAR (Effective Annual Rent):** The actual rent collected, reflecting vacancies and downtime. `EAR = Total rent from actual bookings`
-   **RevPAU (Revenue Per Available Unit):** A key metric that measures how much revenue each of your available units is generating. `RevPAU = Total Revenue / Number of Available Units`

### What Each KPI Means

-   **Occupancy** tells you how full your properties are.
-   **PAR** is your theoretical maximum income.
-   **EAR** is your actual income.
-   **RevPAU** is the most important metric for measuring the financial performance of your inventory, as it balances occupancy and rate.

### How to Identify Underperforming Buildings

Look for buildings with:

-   **Low Occupancy %:** Consistently below the portfolio average.
-   **A large gap between PAR and EAR:** This indicates significant lost revenue due to vacancy.
-   **Low RevPAU:** This shows that the units are not generating as much revenue as they could be.

> **Best Practice:** Use the reports section to drill down into the performance of individual buildings. Compare month-over-month trends to spot issues early.

## 9. Content Management

This section covers how to manage the content displayed on the public-facing Monthly Key website.

### Editing Property Listings

1.  Navigate to **Content > Property Listings**.
2.  Select the property you wish to edit.
3.  Here you can update descriptions, amenities, and other details that are displayed to potential customers.

### Managing Images

High-quality images are crucial for attracting bookings.

1.  In the property editing screen, go to the **"Images"** tab.
2.  You can upload new images, delete old ones, and set a featured image.

> **Best Practice:** Ensure all images are high-resolution and professionally shot. The featured image should be the most attractive shot of the property.

### Updating Site Settings

General site settings can be changed under **Settings > Site**.

-   **Site Name & Logo:** Update the platform's branding.
-   **Terms & Conditions:** Edit the legal terms that customers must agree to.

### Managing FAQ Entries

1.  Navigate to **Content > FAQs**.
2.  Here you can add, edit, or delete frequently asked questions to help customers self-serve.

## 10. Security & Privacy Guidelines

Protecting our data and our customers' data is of the utmost importance. Failure to follow these guidelines can result in disciplinary action and potential legal liability.

### What You CAN Share with Customers

-   Booking confirmation details (dates, unit number, price).
-   Publicly available information about the property.
-   General instructions for check-in and check-out.

### What You MUST NEVER Share

-   **API Keys:** Never share API keys for Moyasar, Beds24, or any other integrated service.
-   **Beds24 Credentials:** Login details for the Beds24 extranet are for internal use only.
-   **Payment Details:** Never ask for or store a customer's full credit card number. All payments must be processed through the secure Moyasar portal.
-   **Other customer's information:** Never share information about one customer with another.

### Password and Access Rules

-   Use a strong, unique password for your admin account.
-   Do not share your login credentials with anyone.
-   Log out of the admin panel when you are finished working.

### Reporting Security Incidents

If you suspect a security breach, data leak, or any other security-related incident, you must report it **immediately** to the CTO. Do not attempt to investigate it yourself. Provide as much detail as possible about the incident.

**Warning: Adherence to these security and privacy guidelines is mandatory. Violations will be taken very seriously.**

## 11. Glossary

| English Term | Arabic Term | Definition |
|---|---|---|
| Ledger | السجل المالي | Financial record of all payment transactions |
| Webhook | ويب هوك | Automated server notification for payment status |
| Source of Truth | مصدر الحقيقة | The authoritative data source for a unit |
| Occupancy | الإشغال | Whether a unit is currently rented |
| PAR | الإيجار السنوي المحتمل | Total potential annual rent from all available units |
| EAR | الإيجار السنوي الفعلي | Effective annual rent based on actual occupancy |
| RevPAU | الإيراد لكل وحدة متاحة | Revenue per available unit |
| Beds24 Mapping | ربط Beds24 | Link between a local unit and a Beds24 room |
| Extension | تمديد | A renewal/extension of a booking period |
| Archive | أرشفة | Soft-delete that hides but preserves data |
