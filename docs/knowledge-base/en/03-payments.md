# 03-Payments
> Last updated: 2026-02-27

This article provides a comprehensive overview of the payment processing system at Monthly Key, which is managed through our integration with Moyasar. It covers the payment workflow, ledger statuses, and procedures for handling refunds and adjustments.

## Payment Processing with Moyasar

All customer payments for bookings and renewals are processed through **Moyasar**, our selected payment gateway. Moyasar provides a secure and reliable way to handle transactions using various payment methods popular in Saudi Arabia.

### Supported Payment Methods

Currently, we support the following payment methods via Moyasar:

- **Mada**: The most common payment card in Saudi Arabia.
- **Apple Pay**: For customers using Apple devices.
- **Google Pay**: For customers using Android devices.

### The Payment Workflow

The payment process is designed to be seamless and automated. Here is a step-by-step breakdown of how a payment is processed:

1.  **Invoice Generation**: When a booking is made or a renewal is due, an invoice is automatically generated in the system with a `DUE` status.
2.  **Payment Attempt**: The customer initiates a payment from their portal using one of the supported methods.
3.  **Moyasar Processing**: The transaction is securely sent to Moyasar for processing. At this point, the ledger status updates to `PENDING`.
4.  **Webhook Finalization**: Moyasar communicates the final transaction status (successful or failed) back to our system via a webhook. Our system listens for this webhook to finalize the payment.
5.  **Status Update**: 
    - If the payment is successful, the ledger status automatically changes to `PAID`.
    - If the payment fails, the status changes to `FAILED`, and the customer is notified to retry the payment.

**Important**: The final status of a payment is determined exclusively by the webhook from Moyasar. It is not possible for any staff member to manually set a payment status to `PAID`.

## Ledger Statuses

The ledger provides a real-time view of the financial status of each booking. Understanding the different statuses is crucial for the **finance** and **ops** teams.

| Status  | Description                                                                                                                              | Next Steps                                                                                                                                      |
|---------|------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `DUE`     | An invoice has been generated and is awaiting payment from the customer.                                                                 | The system will send reminders to the customer. No manual action is needed unless the customer reports an issue.                                |
| `PENDING` | The customer has initiated a payment, and the transaction is currently being processed by Moyasar.                                       | Wait for the webhook from Moyasar to confirm the final status. This should typically take a few seconds to a minute.                            |
| `PAID`    | The payment was successful, and the funds have been confirmed. This status is set automatically by the system upon webhook confirmation. | The booking is confirmed or extended. No further action is needed.                                                                              |
| `FAILED`  | The payment attempt was unsuccessful. This could be due to insufficient funds, incorrect card details, or other bank-related issues. | The customer is automatically notified to try again. If the issue persists, the **support** team may need to assist the customer. See FAQ below. |

## Refunds and Adjustments

Refunds and adjustments are handled by the **finance** team, with oversight from the **admin** role.

### Refunds

A refund can be initiated for a customer in specific situations, such as a cancellation that complies with our policy or a billing error. To process a refund:

1.  The request must be documented with a clear reason.
2.  A member of the **finance** or **admin** team navigates to the specific transaction in the ledger.
3.  The 'Refund' button is used to initiate the process through Moyasar.
4.  The ledger is updated with a corresponding entry for the refunded amount.

### Adjustments

Adjustments are made to correct billing discrepancies that do not involve a direct refund. For example, applying a credit to a customer's account. All adjustments must be approved by the **finance** team and clearly documented in the system with notes explaining the reason for the adjustment.

## Cross-Links to Related Topics

- For more information on staff roles and permissions, see `../en/01-roles-permissions.md`.
- To understand how units are managed, refer to `../en/02-buildings-units.md`.
- For details on the booking process, see `../en/04-bookings.md`.
- For information on extending bookings, refer to `../en/05-renewals.md`.

## FAQ

**1. What should I do if a customer's payment fails repeatedly?**

If a payment fails multiple times, the customer should first be advised to check with their bank to ensure there are no issues with their card or account. The **support** team can then review the transaction logs in the system to see if Moyasar has provided a specific reason for the failure. If the issue remains unresolved, it should be escalated to the **finance** team to investigate further with Moyasar's support.

**2. Can a customer pay with a method not listed (e.g., cash or bank transfer)?**

No. Our payment process is fully automated through Moyasar to ensure efficiency and security. We only accept payments through the methods integrated into our platform: mada, Apple Pay, and Google Pay. Staff should not accept cash or arrange for direct bank transfers.

**3. How long does it take for a refund to be processed and reflected in the customer's account?**

Once a refund is initiated in our system, it is processed by Moyasar immediately. However, it can take between 5 to 10 business days for the funds to appear back in the customer's bank account, depending on their bank's processing times.

**4. Why can't I manually mark a payment as PAID?**

This is a critical security and accounting measure. The `PAID` status is the system's source of truth that funds have been successfully captured. Allowing manual changes would create a risk of error and make it impossible to reconcile our ledger with Moyasar's records. All payments must be confirmed via the automated webhook.

**5. Who should I contact for payment discrepancies?**

Any suspected discrepancies in the ledger, such as a payment that was successful but not marked as `PAID`, should be immediately reported to the **finance** team. They have the tools and access required to investigate and resolve such issues with Moyasar.
