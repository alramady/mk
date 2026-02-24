# Ownership Confirmation

**Date:** February 25, 2026
**Repository:** `raneemndmo-collab/mk`
**Branch:** `platform/monorepo`
**Owner:** Monthly Key

---

## 1. Full Ownership — Work-for-Hire / Full Assignment

All source code, documentation, tests, configuration files, and architectural designs in the `platform/monorepo` branch of this repository are delivered as **work-for-hire with full assignment** to **Monthly Key**. Monthly Key holds **100% ownership** of all intellectual property. This includes but is not limited to:

- `packages/shared/` — shared types, validators, constants, writer-lock logic
- `packages/beds24-sdk/` — Beds24 API V2 SDK with OAuth, token management, admin proxy
- `services/hub-api/` — central API with auth, bookings, units, tickets, webhooks, admin
- `services/cobnb-adapter-api/` — CoBnB dual-mode adapter
- `services/monthlykey-adapter-api/` — MonthlyKey dual-mode adapter
- `services/worker/` — BullMQ webhook processor with retry and dead-letter
- `apps/ops-web/`, `apps/cobnb-web/`, `apps/monthlykey-web/` — frontend scaffolds
- `tests/` — automated tests (writer-lock + webhook rotation)
- `docs/` — all documentation files

Monthly Key may use, modify, distribute, sublicense, sell, or commercialize any or all of this code without restriction, attribution requirement, or royalty obligation to any party.

---

## 2. Zero Manus-Specific Runtime Dependencies

The platform code requires **no Manus SDK, Manus API, Manus service, or Manus infrastructure** to run. Every runtime dependency is a standard, publicly available npm package published under permissive open-source licenses (MIT, Apache-2.0). The complete dependency chain is resolvable from the public npm registry.

---

## 3. No Telemetry, Phone-Home, or License Checks

There is **no code** in the `platform/monorepo` branch that:

- Sends telemetry or analytics to Manus or any third party
- Contacts any Manus server at runtime
- Performs license validation or activation checks
- Contains time-bombs, feature gates, or expiration logic tied to Manus
- Includes obfuscated or minified proprietary code

The only external network calls in the codebase are to **Beds24's public API** (`api.beds24.com`), which is Monthly Key's chosen property management system.

---

## 4. Clear Separation — Manus-Hosted vs. Platform Code

| Component | Manus Dependency | Status |
|-----------|-----------------|--------|
| **`platform/monorepo` branch** (all services, packages, tests, docs) | **NONE** | 100% portable, runs anywhere |
| **`mk-hardening-kb` webdev project** (knowledge base website) | **YES** — uses Manus hosting | Separate artifact, NOT part of the platform |

The `mk-hardening-kb` website is a **completely separate artifact** from the platform. It shares no code, no dependencies, and no runtime coupling with the `platform/monorepo` branch.

---

## 5. Technology Stack — All Standard, All Open-Source

| Layer | Technology | License |
|-------|-----------|---------|
| Runtime | Node.js, Express | MIT |
| Database | PostgreSQL via Drizzle ORM | Apache-2.0 / MIT |
| Queue | Redis via BullMQ | MIT |
| Validation | Zod | MIT |
| Auth | jsonwebtoken, bcrypt | MIT |
| Logging | pino | MIT |
| Testing | Vitest | MIT |
| Frontend | React, Tailwind CSS | MIT |

---

This document is committed to the repository as a permanent record of ownership and independence.
