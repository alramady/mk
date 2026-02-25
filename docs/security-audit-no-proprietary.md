# Security Audit — No Proprietary Dependencies

**Date:** 2026-02-25
**Scope:** MonthlyKey monorepo (`services/hub-api`, `apps/monthlykey-web`, `packages/shared`)
**Auditor:** Development Team

---

## 1. Confirmation of Independence

This document certifies that the MonthlyKey authentication and OTP verification system:

| Requirement | Status |
|---|---|
| No Manus SDKs, services, or webhooks | **Confirmed** |
| No Manus-specific proprietary endpoints | **Confirmed** |
| No telemetry or phone-home mechanisms | **Confirmed** |
| No automation services tied to Manus | **Confirmed** |
| All dependencies are standard OSS (npm registry) | **Confirmed** |
| No hardcoded API keys in source code | **Confirmed** |

---

## 2. Dependencies Used

The authentication system relies exclusively on standard, widely-adopted open-source packages:

| Package | Purpose | License |
|---|---|---|
| `bcryptjs` | Password hashing (bcrypt) | MIT |
| `jsonwebtoken` | JWT token generation and verification | MIT |
| `express` | HTTP server framework | MIT |
| `drizzle-orm` | Type-safe SQL ORM | Apache-2.0 |
| `crypto` (Node.js built-in) | SHA-256 OTP hashing, secure random generation | N/A |

No vendor-specific SDKs (Twilio, SendGrid, etc.) are imported. Provider interfaces are defined as abstractions with console stubs as defaults.

---

## 3. OTP Security Measures

| Measure | Implementation |
|---|---|
| OTP storage | SHA-256(code + salt) — never plaintext |
| OTP length | 6 digits, cryptographically random |
| TTL | 5 minutes |
| Resend cooldown | 60 seconds |
| Max verification attempts | 5 per code |
| Rate limiting | Express rate-limit on `/api/v1/auth/*` endpoints |
| Provider abstraction | `SmsProvider` / `EmailProvider` interfaces with console stubs |

---

## 4. Environment Variables

All sensitive configuration is managed through environment variables. No keys are hardcoded. The `.env.example` file contains only placeholder values:

```
ENABLE_PHONE_VERIFICATION=false
ENABLE_EMAIL_VERIFICATION=false
SMS_PROVIDER=__SET_LATER__
EMAIL_PROVIDER=__SET_LATER__
```

---

## 5. CI Grep Check

A CI script (`scripts/check-no-proprietary.sh`) is provided to fail the build if proprietary strings appear in runtime code paths. Allowed exceptions: documentation files and this audit document.

---

## 6. Data Flow

```
User → Signup (POST /auth/register)
  → Password hashed with bcrypt (10 rounds)
  → User created as PENDING_VERIFICATION
  → JWT issued

User → Send OTP (POST /auth/verification/{phone|email}/send)
  → 6-digit OTP generated (crypto.randomBytes)
  → OTP hashed with SHA-256 + random salt
  → Hash stored in otp_codes table
  → Plaintext sent via provider (console stub in dev)

User → Verify OTP (POST /auth/verification/{phone|email}/verify)
  → Attempt counter incremented
  → Input hashed and compared to stored hash
  → On match: otp_codes.verified_at set, user.{phone|email}_verified_at set
  → When both channels verified: verification_state → VERIFIED
```

---

## 7. Conclusion

The MonthlyKey authentication system is built entirely on standard Node.js/TypeScript libraries and open-source npm packages. It contains no proprietary dependencies, no telemetry, and no vendor lock-in. All provider integrations are abstracted behind interfaces, allowing future replacement without code changes.
