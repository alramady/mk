# Monthly Key (المفتاح الشهري) — Deployment Guide

## Overview

Monthly Key is a full-stack monthly rental platform built with:
- **Frontend**: React 19 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: MySQL (TiDB Cloud compatible)
- **Build tool**: Vite

---

## Environment Variables

### Required (Production)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/dbname` |
| `JWT_SECRET` | Secret key for JWT session tokens (min 32 chars) | `your-secure-random-string-here` |
| `NODE_ENV` | Set to `production` for production builds | `production` |

### OpenAI / LLM (for AI Assistant feature)

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | _(empty — AI features disabled)_ |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Chat model | `gpt-4o-mini` |
| `OPENAI_IMAGE_MODEL` | Image generation model | `dall-e-3` |
| `OPENAI_WHISPER_MODEL` | Speech-to-text model | `whisper-1` |

> **Note**: `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are legacy aliases that map to the OpenAI variables. You only need to set the `OPENAI_*` variables.

### SMTP Email

| Variable | Description | Default |
|---|---|---|
| `SMTP_HOST` | SMTP server hostname | `localhost` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `noreply@localhost` |
| `SMTP_PASS` | SMTP password | _(empty)_ |
| `SMTP_FROM` | Sender email address | `noreply@localhost` |
| `SMTP_SECURE` | Use TLS (`true`/`false`) | `false` |

### OTP / Verification

| Variable | Description | Default |
|---|---|---|
| `OTP_SECRET_PEPPER` | Extra secret added to OTP hashes (change in production!) | `dev-otp-pepper-...` |
| `OTP_TTL_SECONDS` | OTP code validity period | `300` (5 min) |
| `SMS_PROVIDER` | SMS provider: `dev` (console log), or future: `twilio`, `unifonic` | `dev` |
| `SMS_API_KEY` | SMS provider API key | _(empty)_ |
| `EMAIL_PROVIDER` | Email OTP provider: `dev` (console log), `smtp` (uses SMTP config) | `dev` |
| `EMAIL_API_KEY` | Email provider API key (for future SendGrid/Resend) | _(empty)_ |

### Push Notifications (Optional)

| Variable | Description |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for web push |
| `VAPID_PRIVATE_KEY` | VAPID private key for web push |

### File Storage

| Variable | Description | Default |
|---|---|---|
| `UPLOAD_DIR` | Local directory for file uploads | `uploads` |
| `PUBLIC_URL` | Public base URL (auto-detected if empty) | _(empty)_ |
| `MAX_UPLOAD_SIZE` | Max upload size in bytes | `52428800` (50MB) |

### Frontend-only Variables

| Variable | Description |
|---|---|
| `VITE_APP_ID` | Application identifier |
| `VITE_APP_TITLE` | Application title |
| `VITE_APP_LOGO` | Application logo URL |

---

## Database Setup

### 1. Create MySQL Database

```sql
CREATE DATABASE monthly_rental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Run Migrations

Migrations are in `drizzle/` directory, numbered sequentially (0000–0014).

```bash
# Apply all migrations in order
for f in drizzle/0*.sql; do
  mysql -h HOST -u USER -p DATABASE < "$f"
done
```

### 3. Seed Admin User (Optional)

```bash
npx tsx server/seed-admin.ts
```

---

## Build & Deploy

### Local Development

```bash
pnpm install
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm start
```

### Railway Deployment

1. Connect your GitHub repository to Railway
2. Set all required environment variables in Railway dashboard
3. Railway auto-detects the Node.js project and builds with `pnpm build`
4. Set start command: `pnpm start`

### Docker (Alternative)

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## No-Monthly Key Dependency Audit

This project was originally developed using the the platform platform. The following items are **Monthly Key-specific** but do **NOT affect production runtime**:

| Item | Location | Impact | Action Needed |
|---|---|---|---|
| `vite-plugin-Monthly Key-runtime` | `vite.config.ts`, `package.json` | Dev-only Vite plugin, not included in production build | Can be removed if desired |
| `client/public/__Monthly Key__/` | Debug collector scripts | Only loaded in Monthly Key dev environment | Can be deleted |
| `.Monthly Key/` directory | DB query logs, debug data | Not deployed | Can be deleted |
| `files.Monthly Keycdn.com` URLs | Image fallbacks in components | CDN-hosted images, will continue to work | Replace with your own CDN if desired |
| `BUILT_IN_FORGE_API_*` env vars | `server/_core/env.ts` | Legacy aliases for OpenAI vars | Use `OPENAI_*` vars instead |

### To fully remove Monthly Key dependencies:

```bash
# 1. Remove Monthly Key debug collector
rm -rf client/public/__Monthly Key__/

# 2. Remove Monthly Key dev logs
rm -rf .Monthly Key/

# 3. Remove vite-plugin-Monthly Key-runtime from vite.config.ts
# Edit vite.config.ts: remove the import and plugin from the plugins array

# 4. Uninstall the package
pnpm remove vite-plugin-Monthly Key-runtime

# 5. (Optional) Replace Monthly Keycdn.com image URLs with your own CDN
grep -rn "Monthly Keycdn.com" client/src/ | cut -d: -f1 | sort -u
# Then replace URLs in those files
```

### What is NOT Monthly Key-dependent:

- Authentication (pure JWT, local bcrypt)
- Database (standard MySQL/TiDB)
- AI features (standard OpenAI API)
- Email (standard SMTP/nodemailer)
- OTP system (pure Node.js crypto + bcrypt)
- File uploads (local filesystem)
- Push notifications (standard web-push VAPID)

---

## OTP System Architecture

### Flow

```
Step 1: User fills form → POST /api/v1/auth/register → User created (pending)
Step 2: Auto-send phone OTP → POST /api/v1/auth/otp/send (channel=phone)
        User enters code → POST /api/v1/auth/otp/verify → phoneVerified=true
Step 3: Auto-send email OTP → POST /api/v1/auth/otp/send (channel=email)
        User enters code → POST /api/v1/auth/otp/verify → emailVerified=true → auto-login
```

### Provider Adapters

SMS and Email OTP sending is abstracted behind provider interfaces:

- **Dev mode** (`SMS_PROVIDER=dev`, `EMAIL_PROVIDER=dev`): Logs OTP to server console
- **SMTP mode** (`EMAIL_PROVIDER=smtp`): Uses existing nodemailer/SMTP config
- **Future**: Plug Twilio, Unifonic, SendGrid, Resend by implementing the `SmsProvider` / `EmailOtpProvider` interfaces in `server/otp-providers.ts`

### Security

- OTP codes: 6-digit, cryptographically random (`crypto.randomBytes`)
- Storage: bcrypt hash with pepper (never stored in plaintext)
- Rate limiting: 3 sends per destination per 10 min, 10 sends per IP per 10 min
- Max attempts: 5 verification attempts per code
- TTL: 5 minutes (configurable via `OTP_TTL_SECONDS`)

---

## Running Tests

```bash
# OTP unit tests
npx tsx server/__tests__/otp.test.ts

# OAuth removal verification tests
npx tsx server/oauth-removal.test.ts

# Platform settings tests
npx tsx server/platform.test.ts
```
