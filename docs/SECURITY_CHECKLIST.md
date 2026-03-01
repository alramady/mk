# Monthly Key — Pre-Deploy Security Checklist

**Document Version:** 1.0
**Date:** February 25, 2026
**Author:** the platform

---

This checklist must be completed before every production deployment. Any item marked as **FAIL** must be resolved before the deployment proceeds.

---

## 1. Environment & Secrets

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 1.1 | JWT secret is NOT the default value | `echo $JWT_SECRET` — must not match `.env.platform.example` default | ☐ |
| 1.2 | JWT secret is ≥ 64 characters | `echo -n $JWT_SECRET \| wc -c` — must be ≥ 64 | ☐ |
| 1.3 | Database credentials are unique per environment | Compare dev/staging/prod `DATABASE_URL` values | ☐ |
| 1.4 | Beds24 refresh token is set (if Beds24 enabled) | `echo $BEDS24_REFRESH_TOKEN` — must be non-empty | ☐ |
| 1.5 | Beds24 webhook secret is set (if webhooks enabled) | `echo $BEDS24_WEBHOOK_SECRET` — must be non-empty | ☐ |
| 1.6 | PayPal credentials are production (not sandbox) | Verify `PAYPAL_CLIENT_ID` starts with production prefix | ☐ |
| 1.7 | S3 credentials are scoped to minimum permissions | Review IAM policy — should only allow `s3:PutObject`, `s3:GetObject` on the specific bucket | ☐ |
| 1.8 | No secrets in Git history | `git log --all -p \| grep -i "password\|secret\|api_key"` — must return nothing sensitive | ☐ |
| 1.9 | `.env` files are in `.gitignore` | `cat .gitignore \| grep .env` — must be present | ☐ |
| 1.10 | `NODE_ENV=production` is set | `echo $NODE_ENV` — must be `production` | ☐ |

## 2. Authentication & Authorization

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 2.1 | Password minimum length ≥ 12 characters | Review `server/_core/auth.ts` password validation | ☐ |
| 2.2 | Password complexity requirements enforced | Must require: uppercase, lowercase, number, special char | ☐ |
| 2.3 | Session expiration ≤ 30 minutes (access token) | Review JWT `expiresIn` in auth.ts | ☐ |
| 2.4 | Refresh token rotation is implemented | Verify refresh token is invalidated after use | ☐ |
| 2.5 | Role-based access control on all admin routes | Test: tenant token → admin endpoint → should return 403 | ☐ |
| 2.6 | Rate limiting on auth endpoints (≤ 5 req/min) | `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}" POST /api/auth/login; done` | ☐ |
| 2.7 | Account lockout after 5 failed attempts | Test: 5 wrong passwords → account should be temporarily locked | ☐ |
| 2.8 | Password hashing uses bcrypt with cost ≥ 10 | Review `bcryptjs.hash()` call — salt rounds parameter | ☐ |

## 3. Input Validation & Injection Prevention

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 3.1 | All API inputs validated with Zod schemas | Review tRPC procedures — all must have `.input(z.object(...))` | ☐ |
| 3.2 | No raw SQL with user input interpolation | `grep -rn "sql\`" server/ \| grep -v "sql()" ` — review each for user input | ☐ |
| 3.3 | File upload type validation (server-side) | Upload a `.exe` file — should be rejected | ☐ |
| 3.4 | File upload size limit enforced | Upload a 100MB file — should be rejected | ☐ |
| 3.5 | Uploaded files are not served with execute permissions | Check upload directory permissions — no execute bit | ☐ |
| 3.6 | HTML output is escaped (XSS prevention) | React handles this by default — verify no `dangerouslySetInnerHTML` with user input | ☐ |
| 3.7 | URL parameters are validated before use | Review all `useParams()` usage — values must be validated | ☐ |

## 4. HTTP Security Headers

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 4.1 | Strict-Transport-Security header present | `curl -I https://monthlykey.com \| grep strict` | ☐ |
| 4.2 | X-Content-Type-Options: nosniff | `curl -I https://monthlykey.com \| grep nosniff` | ☐ |
| 4.3 | X-Frame-Options: DENY or SAMEORIGIN | `curl -I https://monthlykey.com \| grep frame` | ☐ |
| 4.4 | Content-Security-Policy does NOT contain `unsafe-inline` | `curl -I https://monthlykey.com \| grep -i csp` | ☐ |
| 4.5 | Content-Security-Policy does NOT contain `unsafe-eval` | Same as above | ☐ |
| 4.6 | Referrer-Policy is set | `curl -I https://monthlykey.com \| grep referrer` | ☐ |
| 4.7 | Permissions-Policy restricts unnecessary APIs | Review `security-headers.ts` for camera, microphone, geolocation restrictions | ☐ |

## 5. Data Protection

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 5.1 | TLS 1.2+ enforced (no HTTP) | `curl http://monthlykey.com` — should redirect to HTTPS | ☐ |
| 5.2 | Cookies have `Secure` flag | Review `Set-Cookie` headers — all must have `Secure` | ☐ |
| 5.3 | Cookies have `HttpOnly` flag | Review `Set-Cookie` headers — session cookies must have `HttpOnly` | ☐ |
| 5.4 | Cookies have `SameSite=Strict` or `Lax` | Review cookie settings in auth.ts | ☐ |
| 5.5 | PII is not logged | Review logger configuration — email, phone, password, nationalId must be redacted | ☐ |
| 5.6 | Database connections use SSL | Check `DATABASE_URL` — must include `?ssl=true` or equivalent | ☐ |
| 5.7 | S3 bucket is not publicly accessible | Test: `curl https://bucket-name.s3.amazonaws.com/` — should return 403 | ☐ |
| 5.8 | User data deletion endpoint exists | Verify PDPL compliance — users can request data deletion | ☐ |

## 6. Infrastructure & Deployment

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 6.1 | Docker image runs as non-root user | Review `Dockerfile` — should have `USER` directive | ☐ |
| 6.2 | Upload directory permissions ≤ 755 | `ls -la /app/uploads` — should NOT be 777 | ☐ |
| 6.3 | Health check endpoint returns meaningful status | `curl /health` — should return JSON with service status | ☐ |
| 6.4 | Railway health check path is `/health` (not `/`) | Review `railway.toml` `healthcheckPath` | ☐ |
| 6.5 | Database migrations succeed before app starts | `start.sh` should exit on migration failure | ☐ |
| 6.6 | Error responses do not leak stack traces | Test: trigger a 500 error — response should not contain file paths or stack | ☐ |
| 6.7 | Debug tools are disabled in production | Verify `vitePluginMonthly KeyDebugCollector` is excluded from production build | ☐ |
| 6.8 | `npm audit` shows no critical/high vulnerabilities | `pnpm audit --audit-level=high` — must pass | ☐ |

## 7. Database Integrity

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 7.1 | Foreign key constraints are defined | Review `drizzle/schema.ts` — all relationship columns must have `references()` | ☐ |
| 7.2 | Financial operations use transactions | Review `server/db.ts` — payment/booking updates must use `db.transaction()` | ☐ |
| 7.3 | Idempotency keys on critical operations | Bookings and payments must have `idempotencyKey` column | ☐ |
| 7.4 | Database backups are configured | Verify TiDB Cloud backup schedule — daily minimum | ☐ |
| 7.5 | Migration rollback is possible | Test: apply migration, then rollback — data should be intact | ☐ |

## 8. Monitoring & Incident Response

| # | Check | How to Verify | Status |
|---|-------|--------------|--------|
| 8.1 | Error tracking service is configured (Sentry) | Verify `SENTRY_DSN` is set and errors are captured | ☐ |
| 8.2 | Uptime monitoring is active | External monitor (UptimeRobot, Pingdom) checks `/health` every 1 min | ☐ |
| 8.3 | Alert channels are configured | Slack/email alerts for: downtime, error spikes, high latency | ☐ |
| 8.4 | Incident response runbook exists | Document: who to contact, how to rollback, how to scale | ☐ |
| 8.5 | Log retention policy is defined | Logs retained for 30 days minimum, 90 days recommended | ☐ |

---

## Checklist Summary

| Section | Items | Must Pass |
|---------|-------|-----------|
| Environment & Secrets | 10 | All |
| Authentication & Authorization | 8 | All |
| Input Validation | 7 | All |
| HTTP Security Headers | 7 | All |
| Data Protection | 8 | All |
| Infrastructure & Deployment | 8 | All |
| Database Integrity | 5 | All |
| Monitoring & Incident Response | 5 | Items 8.1–8.3 |
| **Total** | **58** | **55 mandatory** |

> **Deployment Gate:** A deployment MUST NOT proceed if any mandatory item is marked FAIL. The responsible engineer must sign off on this checklist before each production release.

---

*End of Security Checklist*
